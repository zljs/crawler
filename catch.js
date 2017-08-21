// var colors = require("colors");

var node = {
    "async": require("async"),
    "cheerio": require("cheerio"),
    "fs": require("fs"),
    "path": require("path"),
    "mkdirp": require("mkdirp"),
    "request": require("request"),
    "mongoose": require("mongoose"),
    "url": require("url"),
    "mongourl": "mongodb://localhost/catchPic"
};

node.mongoose.connect(node.mongourl);
var Schema = node.mongoose.Schema;

var pictureSchema = new Schema({
    uId: String, //用户id，管理员
    num: Number, //点赞数
    tel: String, //电话联系，发放奖品依据
    name: String,
    description: String,
    imgSrc: String,
    pass: Boolean //是否通过审核
})

var Picture = node.mongoose.model('Picture', pictureSchema);

var Spider = {
    /*
    配置选项
     */
    options: {
        uri: "http://wuxianfuli.cc/pic/?paged=",
        saveTo: 'weheartit',
        element:".entry-content p>img",
        startPage: 1,
        endPage: 3,
        downLimit:2
    },
    posts: [],
    /*
    开始下载(程序入口函数)
     */
    start() {
        var async = node.async;
        async.waterfall([
            this.getPages.bind(this),
            this.downAllImages.bind(this),
        ], (err, result) => {
            if (err) {
                console.log("error:%s", err.message);

            } else {
                console.log("succcess:下载完成");
                node.mongoose.disconnect();
            };
        })
    },
    /*
    爬取所有页面
     */
    getPages(callback) {
        var async = node.async;
        var i = this.options.startPage || 1;
        async.doWhilst((callback) => {
            var uri = this.options.uri + '' + i ;
            async.waterfall([
                //下载单个页面
                this.downPage.bind(this, uri, i),
                //分析页面
                this.parsePage.bind(this)
            ], callback);
            i++;
        }, (page) => this.options.endPage > page, callback)
    },
    /*
    下载单个页面
     */
    downPage(uri, curpage, callback) {
        console.log('开始下载页面： %s', uri);
        // 反爬虫策略cookie
        var options = {
            url: uri,
            // procy: 'http://127.0.0.1:8123',
            // header: {
            //     "User-Agent": "Mozilla/5.0 (windows NT 6.1;WOW64)
            //     AppleWebKit / 537.36() "
            // }
        };
        node.request(options, (err, res, body) => {
            if (!err) {
                console.log('下载页面成功： %s', uri);

            };
            var page = {
                page: curpage,
                uri: uri,
                html: body
            };
            callback(err, page);
        })
    },
    /*
    解析单个页面并获取数据
     */
    parsePage(page, callback) {
        var $ = node.cheerio.load(page.html);
        var self = this;
        var $imgs = $(self.options.element);
        var src = [];

        $imgs.each(function() {
            var href = $(this).attr('src') ? $(this).attr('src') : null;
            node.fs.appendFileSync('picture_src.txt', href + '\n');
            src.push(href);
        });
        self.posts.push({
            info:{
                loc:src,
                pageNum:page.page
            },
            title: "page" + page.page
        });
        console.log("分析页面数据成功：共%d张图片", $imgs.length);
        callback(null, page.page)
    },
    /*
    下载全部图片
     */
    downAllImages(page, callback) {
        var async = node.async;
        console.log("开始全力下载所有图片，共%d篇",this.posts.length);
        async.eachSeries(this.posts,this.downPostImages.bind(this),callback);

    },
    /*
    下载单个页面的图片
    @params {Object} post
     */
    downPostImages(post,callback){
        var async = node.async;
        async.waterfall([
            this.mkdir.bind(this,post),
            this.downImages.bind(this)
            ],callback);
    },
    /*
    创建目录
     */
     mkdir(post,callback){
        var path = node.path;
        var imgPath = "E:/BaiduNetdiskDownload/catch_pic/images";
        post.dir = path.join(imgPath,path.join(this.options.saveTo,post.title));
        console.log("准备创建目录：%s",post.dir);
        if (node.fs.existsSync(post.dir)) {
            callback(null,post);
            console.log("目录：%s已经存在",post.dir);
            return;

        };
        node.mkdirp(post.dir,(err) => {
            callback(err,post);
            console.log("目录：%s创建成功",post.dir);

        })

     },
     /*
     下载post图片列表中的图片
      */
     downImages(post,callback){
        console.log("发现%d张图片，准备开始下载...",post.info.loc.length);
        console.log(post);
        node.async.eachLimit(post.info.loc,this.options.downLimit,this.downImage.bind(this,post),callback);
     },
     downImage(post,imgsrc,callback){
        var url = node.url.parse(imgsrc);
        var fileName = (url.path).split("/")[2] + ".jpg";
        var toPath = node.path.join(post.dir,fileName);
        console.log("开始下载图片：%s，保存到：%s",fileName,post.dir);

        var options = {
            url: encodeURI(imgsrc),
            // procy: 'http://127.0.0.1:8123',
            // header: {
            //     "User-Agent": "Mozilla/5.0 (windows NT 6.1;WOW64)
            //     AppleWebKit / 537.36() "
            // }
        };

        node.request(options).pipe(node.fs.createWriteStream(toPath)).on("close",() => {
            console.log("图片下载成功： %s",imgsrc);
            callback();

        }).on("error",callback);

        var localSrc = this.options.saveTo + "/" + post.title + "/" + fileName;
        console.log("将图片：%s的信息存入Mongodb，e.g:%s",fileName,localSrc);
        Picture.create({
            uId:"zoulei",
            name:fileName,
            descriptions:post.title,
            imgSrc:localSrc,
            tel:"",
            num:post.info.pageNum,
            pass:true
        })

     }
};

Spider.start();
