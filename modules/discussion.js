let Problem = syzoj.model('problem');
let Article = syzoj.model('article');
let ArticleComment = syzoj.model('article-comment');
let User = syzoj.model('user');
let Contest = syzoj.model('contest');
let Feed = syzoj.model('feed');

const forum_list = syzoj.forum_list = [
  { name: 'global', title: '全局版块', icon: 'world', default: true, admin: false },
  ...syzoj.config.discussion_forums,
  { name: 'problems', title: '题目', icon: 'book', admin: false },
  { name: 'solutions', title: '题解', icon: 'code', admin: false }
];
const forum_map = syzoj.forum_map = new Map(forum_list.map(forum => [forum.name, forum]));
const forums = forum_list.map(({ name }) => name);
const forums_admin = forum_list.filter(forum => forum.admin).map(forum => forum.name);
const problem_forums = syzoj.problem_forums = ['problems', 'solutions'];

app.get('/discussion/:type?', async (req, res) => {
  try {
    const forum = req.params.type;

    if (!forums.includes(forum)) {
      res.redirect(syzoj.utils.makeUrl(['discussion', 'global']));
    }

    if (forums_admin.includes(forum) && (!res.locals.user || !await res.locals.user.hasPrivilege('view_admin_forum'))) {
      throw new ErrorMessage('您没有权限进行此操作。');
    }

    let where = { forum };
    if (!res.locals.user || !await res.locals.user.hasPrivilege('manage_discussion')) where.is_show = 1;
    let paginate = syzoj.utils.paginate(await Article.countForPagination(where), req.query.page, syzoj.config.page.discussion);
    let articles = await Article.queryPage(paginate, where, {
      priority: 'DESC',
      sort_time: 'DESC'
    });

    let shownArticles = [];

    for (let article of articles) {
      await article.loadRelationships();
      if (article.problem_id) {
        article.problem = await Problem.findById(article.problem_id);
        if (await article.problem.isAllowedUseBy(res.locals.user)) {
          shownArticles.push(article);
        }
      } else {
        shownArticles.push(article);
      }
    }

    res.render('discussion', {
      articles: shownArticles,
      paginate: paginate,
      problem: null,
      forum: forum
    });
  } catch (e) {
    syzoj.log(e);
    res.render('error', {
      err: e
    });
  }
});

app.get('/discussion/problem/:pid', async (req, res) => {
  try {
    let pid = parseInt(req.params.pid);
    let problem = await Problem.findById(pid);
    if (!problem) throw new ErrorMessage('无此题目。');
    if (!await problem.isAllowedUseBy(res.locals.user)) {
      throw new ErrorMessage('您没有权限进行此操作。');
    }

    let where = { forum: "problems", problem_id: pid };
    let paginate = syzoj.utils.paginate(await Article.countForPagination(where), req.query.page, syzoj.config.page.discussion);
    let articles = await Article.queryPage(paginate, where, {
      sort_time: 'DESC'
    });

    for (let article of articles) await article.loadRelationships();

    res.render('discussion', {
      articles: articles,
      paginate: paginate,
      problem: problem,
      forum: 'problems'
    });
  } catch (e) {
    syzoj.log(e);
    res.render('error', {
      err: e
    });
  }
});

app.post('/article/:id/show', async (req, res) => {
  try {
    let id = parseInt(req.params.id);
    let article = await Article.findById(id);
    if (!article) throw new ErrorMessage('无此帖子。');
    if (!res.locals.user || !await res.locals.user.hasPrivilege('manage_discussion')) throw new ErrorMessage('您没有权限进行此操作。');
    await article.loadRelationships();
    article.is_show = 1;
    await article.save();
    res.redirect(syzoj.utils.makeUrl(['article', article.id]));
  } catch (e) {
    syzoj.log(e);
    res.render('error', {
      err: e
    });
  }
});

app.post('/article/:id/hide', async (req, res) => {
  try {
    let id = parseInt(req.params.id);
    let article = await Article.findById(id);
    if (!article) throw new ErrorMessage('无此帖子。');
    if (!res.locals.user || !await res.locals.user.hasPrivilege('manage_discussion')) throw new ErrorMessage('您没有权限进行此操作。');
    await article.loadRelationships();
    article.is_show = 0;
    await article.save();
    res.redirect(syzoj.utils.makeUrl(['article', article.id]));
  } catch (e) {
    syzoj.log(e);
    res.render('error', {
      err: e
    });
  }
});

app.post('/article/:id/priority_up', async (req, res) => {
  try {
    let id = parseInt(req.params.id);
    let article = await Article.findById(id);
    if (!article) throw new ErrorMessage('无此帖子。');
    if (!res.locals.user || !await res.locals.user.hasPrivilege('manage_discussion')) throw new ErrorMessage('您没有权限进行此操作。');
    await article.loadRelationships();
    article.priority += 1;
    await article.save();
    res.redirect(syzoj.utils.makeUrl(['article', article.id]));
  } catch (e) {
    syzoj.log(e);
    res.render('error', {
      err: e
    });
  }
});

app.post('/article/:id/priority_down', async (req, res) => {
  try {
    let id = parseInt(req.params.id);
    let article = await Article.findById(id);
    if (!article) throw new ErrorMessage('无此帖子。');
    if (!res.locals.user || !await res.locals.user.hasPrivilege('manage_discussion')) throw new ErrorMessage('您没有权限进行此操作。');
    await article.loadRelationships();
    article.priority -= 1;
    await article.save();
    res.redirect(syzoj.utils.makeUrl(['article', article.id]));
  } catch (e) {
    syzoj.log(e);
    res.render('error', {
      err: e
    });
  }
});

app.get('/article/:id', app.useRestriction, async (req, res) => {
  try {
    let id = parseInt(req.params.id);
    let article = await Article.findById(id);
    if (!article) throw new ErrorMessage('无此帖子。');

    await article.loadRelationships();
    article.allowedEdit = await article.isAllowedEditBy(res.locals.user);
    article.allowedComment = await article.isAllowedCommentBy(res.locals.user);

    let where = { article_id: id };
    let commentsCount = await ArticleComment.countForPagination(where);
    let paginate = syzoj.utils.paginate(commentsCount, req.query.page, syzoj.config.page.article_comment);

    let comments = await ArticleComment.queryPage(paginate, where, {
      public_time: 'DESC'
    });

    if (!await article.isAllowedVisitBy(res.locals.user)) throw new ErrorMessage('您没有权限查看本帖子。');

    for (let comment of comments) {
      comment.rendered_content = await syzoj.utils.markdown(comment.content);
      comment.allowedEdit = await comment.isAllowedEditBy(res.locals.user);
      await comment.loadRelationships();
    }

    let problem, contest;
    if (article.problem_id) {
      problem = article.problem = await Problem.findById(article.problem_id);
      if (req.query.contest_id) {
        contest = await Contest.findById(req.query.contest_id);
        if (!contest) throw new ErrorMessage('无此比赛。');
        contest.problems_id = await contest.getProblems();
        if (!contest.problems_id.includes(problem.id)) throw new ErrorMessage('比赛中无此题目。');
        if (!contest.allowedSeeingSolution()) throw new ErrorMessage('您没有权限进行此操作。');
      } else if (!await problem.isAllowedUseBy(res.locals.user)) {
        throw new ErrorMessage('您没有权限进行此操作。');
      }
    }

    await article.updateViews(res.locals.user);

    article.rendered_content = await syzoj.utils.markdown(article.content);

    res.render('article', {
      article: article,
      comments: comments,
      paginate: paginate,
      problem: problem,
      commentsCount: commentsCount,
      is_edit: false,
      contest: contest,
      canManage: res.locals.user && await res.locals.user.hasPrivilege('manage_discussion'),
      priority_color: article.priority < 0 ? "#C02828" : "#219945",
      priority_show: article.priority !== 0
    });
  } catch (e) {
    syzoj.log(e);
    res.render('error', {
      err: e
    });
  }
});

app.get('/article/:id/edit', async (req, res) => {
  try {
    if (!res.locals.user) throw new ErrorMessage('请登录后继续。', { '登录': syzoj.utils.makeUrl(['login'], { 'url': req.originalUrl }) });

    let id = parseInt(req.params.id);
    let article = await Article.findById(id);

    if (!article) {
      article = await Article.create();
      article.id = 0;
      article.allowedEdit = true;

      const { forum, problem_id } = req.query;

      if (!forums.includes(forum)) throw new ErrorMessage('无此版块。');
      article.forum = forum;

      if (problem_forums.includes(forum)) {
        let problem = await Problem.findById(problem_id);
        if (!problem) throw new ErrorMessage("无此题目。");
        if (!await problem.isAllowedUseBy(res.locals.user)) {
          throw new ErrorMessage('您没有权限进行此操作。');
        }
        article.problem_id = problem.id;
        article.problem = problem;
      }
    } else {
      if (!article.is_show && !await article.isAllowedVisitBy(res.locals.user)) {
        throw new ErrorMessage('您没有权限修改本帖子。');
      }
      article.allowedEdit = await article.isAllowedEditBy(res.locals.user);
      if (article.problem_id) {
        article.problem = await Problem.findById(article.problem_id);
      }
    }

    res.render('article_edit', {
      article: article,
      is_edit: true
    });
  } catch (e) {
    syzoj.log(e);
    res.render('error', {
      err: e
    });
  }
});

app.post('/article/:id/edit', async (req, res) => {
  try {
    if (!res.locals.user) throw new ErrorMessage('请登录后继续。', { '登录': syzoj.utils.makeUrl(['login'], { 'url': req.originalUrl }) });

    let id = parseInt(req.params.id);
    let article = await Article.findById(id);

    let time = syzoj.utils.getCurrentDate();
    if (!article) {
      article = await Article.create();
      article.user_id = res.locals.user.id;
      article.public_time = article.sort_time = time;

      const { forum, problem_id } = req.query;
      if (!forums.includes(forum)) throw new ErrorMessage('无此版块。');

      article.forum = forum;

      if (problem_forums.includes(forum) && problem_id) {
        let problem = await Problem.findById(problem_id);
        if (!problem) throw new ErrorMessage('无此题目。');
        article.problem_id = problem.id;
      } else {
        article.problem_id = null;
      }
    } else {
      if (!await article.isAllowedEditBy(res.locals.user)) throw new ErrorMessage('您没有权限进行此操作。');
    }

    if (!req.body.title.trim()) throw new ErrorMessage('标题不能为空。');
    article.title = req.body.title;
    article.content = req.body.content;
    article.update_time = time;
    article.is_notice = (res.locals.user && res.locals.user.is_admin ? req.body.is_notice === 'on' : article.is_notice);

    await article.save();

    res.redirect(syzoj.utils.makeUrl(['article', article.id]));
  } catch (e) {
    syzoj.log(e);
    res.render('error', {
      err: e
    });
  }
});

app.post('/article/:id/delete', async (req, res) => {
  try {
    if (!res.locals.user) throw new ErrorMessage('请登录后继续。', { '登录': syzoj.utils.makeUrl(['login'], { 'url': req.originalUrl }) });

    let id = parseInt(req.params.id);
    let article = await Article.findById(id);

    if (!article) {
      throw new ErrorMessage('无此帖子。');
    } else {
      if (!await article.isAllowedEditBy(res.locals.user)) throw new ErrorMessage('您没有权限进行此操作。');
    }

    await article.delete();

    res.redirect(syzoj.utils.makeUrl(['discussion', 'global']));
  } catch (e) {
    syzoj.log(e);
    res.render('error', {
      err: e
    });
  }
});

app.post('/article/:id/comment', async (req, res) => {
  try {
    if (!res.locals.user) throw new ErrorMessage('请登录后继续。', { '登录': syzoj.utils.makeUrl(['login'], { 'url': req.originalUrl }) });

    let id = parseInt(req.params.id);
    let article = await Article.findById(id);

    if (!article) {
      throw new ErrorMessage('无此帖子。');
    } else {
      if (!await article.isAllowedCommentBy(res.locals.user)) throw new ErrorMessage('您没有权限进行此操作。');
    }

    let comment = await ArticleComment.create({
      content: req.body.comment,
      article_id: id,
      user_id: res.locals.user.id,
      public_time: syzoj.utils.getCurrentDate()
    });

    await comment.save();

    await article.resetReplyCountAndTime();

    res.redirect(syzoj.utils.makeUrl(['article', article.id]));
  } catch (e) {
    syzoj.log(e);
    res.render('error', {
      err: e
    });
  }
});

app.post('/article/:article_id/comment/:id/delete', async (req, res) => {
  try {
    if (!res.locals.user) throw new ErrorMessage('请登录后继续。', { '登录': syzoj.utils.makeUrl(['login'], { 'url': req.originalUrl }) });

    let id = parseInt(req.params.id);
    let comment = await ArticleComment.findById(id);

    if (!comment) {
      throw new ErrorMessage('无此评论。');
    } else {
      if (!await comment.isAllowedEditBy(res.locals.user)) throw new ErrorMessage('您没有权限进行此操作。');
    }

    const article = await Article.findById(comment.article_id);

    await comment.destroy();

    await article.resetReplyCountAndTime();

    res.redirect(syzoj.utils.makeUrl(['article', comment.article_id]));
  } catch (e) {
    syzoj.log(e);
    res.render('error', {
      err: e
    });
  }
});

app.get('/api/article/:id/vote', async (req, res) => {
  try {
    const article = await Article.findById(req.params.id);
    if (!article) throw new ErrorMessage('无此帖子。');

    const result = await article.getVoteSummary(res.locals.user);

    res.send({
      error: null,
      result
    });
  } catch (e) {
    syzoj.log(e);
    res.send({
      error: e.message
    });
  }
});

app.post('/api/article/:id/vote/:vote', async (req, res) => {
  try {
    const { user } = res.locals;
    if (!user) throw new ErrorMessage('请登录后继续。', { '登录': syzoj.utils.makeUrl(['login'], { 'url': req.originalUrl }) });

    const article = await Article.findById(req.params.id);
    if (!article) throw new ErrorMessage('无此帖子。');

    const voteType = parseInt(req.params.vote);
    if (![1, -1, 0].includes(voteType)) throw new ErrorMessage('参数错误。');

    await article.setVoteBy(user, voteType ? voteType : null);

    const result = await article.getVoteSummary(user);

    res.send({
      error: null,
      result
    });
  } catch (e) {
    syzoj.log(e);
    res.send({
      error: e.message
    });
  }
});

app.post('/api/feed/new', async (req, res) => {
  try {
    const { user } = res.locals;
    if (!user) throw new ErrorMessage('请登录后继续。', { '登录': syzoj.utils.makeUrl(['login'], { 'url': req.originalUrl }) });
    if (!req.body.content) throw new ErrorMessage('犇犇内容为空。');
    let feed = await Feed.create();
    feed.user_id = user.id;
    feed.time = syzoj.utils.getCurrentDate();
    feed.content = req.body.content;
    await feed.save();
    res.redirect("/");
  } catch (e) {
    syzoj.log(e);
    res.send({
      error: e.message
    });
  }
});