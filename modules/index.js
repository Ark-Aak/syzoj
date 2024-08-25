let User = syzoj.model('user');
let Article = syzoj.model('article');
let Contest = syzoj.model('contest');
let Problem = syzoj.model('problem');
let Divine = syzoj.lib('divine');
let Feed = syzoj.model('feed');
let TimeAgo = require('javascript-time-ago');
let zh = require('../libs/timeago');
TimeAgo.locale(zh);
const timeAgo = new TimeAgo('zh-CN');

app.get('/', async (req, res) => {
  try {
    let ranklist_where = { is_show: true };
    if (syzoj.config.ranklist_rated_only) ranklist_where.is_rated = true;
    if (syzoj.config.ranklist_verified_only) ranklist_where.is_verified = true;
    let ranklist = await User.queryRange([1, syzoj.config.page.ranklist_index], ranklist_where, {
      [syzoj.config.sorting.ranklist.field]: syzoj.config.sorting.ranklist.order
    });
    await ranklist.forEachAsync(async x => x.renderInformation());

    let notices = (await Article.find({
      where: { is_notice: true }, 
      order: { update_time: 'DESC' }
    })).map(article => ({
      title: article.title,
      url: syzoj.utils.makeUrl(['article', article.id]),
      date: syzoj.utils.formatDate(article.update_time, 'L')
    }));

    let fortune = null;
    if (res.locals.user && syzoj.config.divine) {
      fortune = Divine(res.locals.user.username, res.locals.user.sex);
    }

    let contests = await Contest.queryRange([1, 5], { is_public: true }, {
      start_time: 'DESC'
    });

    let problems = (await Problem.queryRange([1, 5], { is_public: true }, {
      publicize_time: 'DESC'
    })).map(problem => ({
      id: problem.id,
      title: problem.title,
      time: timeAgo.format(new Date(problem.publicize_time)),
    }));
    
    let todoList = null;
    if (res.locals.user) {
      let problem_ids = await res.locals.user.getTodoList();
      todoList = await problem_ids.mapAsync(async (problem_id) => {
        let problem = await Problem.findOne({
          select: ["id", "title"],
          where: { id: problem_id }
        });
        problem.judge_state = await problem.getJudgeState(res.locals.user, true);
        return problem;
      });
    }

    let query = Feed.createQueryBuilder();
    query.orderBy('time', 'DESC')
         .limit(30);
    let feeds = await query.getMany();

    for (let feed of feeds) { 
      await feed.loadRelationships();
      feed.rendered_content = await syzoj.utils.markdown(feed.content);
    }

    const daysChinese = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];
    const DATE = new Date(syzoj.utils.getCurrentDate() * 1000);

    const monthChinese = ['一月大', '二月小', '三月大', '四月小', '五月大', '六月小', '七月大', '八月大', '九月小', '十月大', '冬月小', '腊月大'];

    res.render('index', {
      ranklist: ranklist,
      notices: notices,
      fortune: fortune,
      contests: contests,
      problems: problems,
      todoList: todoList,
      links: syzoj.config.links,
      tar_year: year,
      tar_day: day,
      tar_color: tar_color,
      tar_arc: day / 365 * 409,
      tar_name: tar_name,
      feeds: feeds,
      date: DATE.getDate(),
      days: daysChinese[DATE.getDay()],
      month: monthChinese[DATE.getMonth()]
    });
  } catch (e) {
    syzoj.log(e);
    res.render('error', {
      err: e
    });
  }
});

app.post('/signin', async (req, res) => {
  try {
    if (!res.locals.user) throw new ErrorMessage('请登录后继续。', { '登录': syzoj.utils.makeUrl(['login'], { 'url': req.originalUrl }) });
    if (!res.locals.user.canSignIn()) throw new ErrorMessage('你今天已经签过到了，不要着急哦。');
    await res.locals.user.updateSignIn();
    res.redirect('/');
  } catch (e) {
    syzoj.log(e);
    res.render('error', {
      err: e
    });
  }
})

app.get('/help', async (req, res) => {
  try {
    res.render('help');
  } catch (e) {
    syzoj.log(e);
    res.render('error', {
      err: e
    });
  }
});

let getTarDay = function () {
  return new Date(2024, 10, 31);
}
let year = new Date ().getFullYear ();
let day = parseInt ((getTarDay (year) - new Date ()) / (1000 * 60 * 60 * 24));
if (day == -1) {
  day = 0;
}
else if (day < -1) {
  ++year;
  day = parseInt ((getTarDay (year) - new Date ()) / (1000 * 60 * 60 * 24));
}

const tar_name = "NOIp";

let tar_color;
if (day <= 91) {
  tar_color = "#e74c3c";
}
else if (day <= 182) {
  tar_color = "#e67e22";
}
else if (day <= 273) {
  tar_color = "#f1c40f";
}
else {
  tar_color = "#2dce89";
}