//---------------------------------------------------------------------------
//
// g_bui 是基于 redips-drag based UI 实现的，包含了进行交互的接口
//
// g_letters -  用来存放所有的字母分布、分数
// g_vowels - 是用来存储元音的，这个是为了方便电脑下子
// g_letrange - 正则表达式，其实就是 "[a-z]"
//
// 以上的变量都可以在 lang 里面找到
//---------------------------------------------------------------------------

// 各种变量的声明

var g_board;                // 存已经下了的字母
var g_boardpoints;          // 存点位置 [1,2]
var g_boardmults;           // 存 bonus (DL, TL, DW, TW)
var g_letpool       = [];   // 字母池
var g_letscore      = {};   // 每个字母的 score
var g_racksize      = 7;    // 单词最大长度、7个

var g_matches_cache = {};   // 我用这个来加快正则匹配

var g_pscore        = 0;    // player score
var g_oscore        = 0;    // computer score

var g_board_empty   = true;

var g_passes        = 0;    // 当前 pass 次数
var g_maxpasses     = 2;    // 最多 pass 次数
var g_lmults = [1,2,3,1,1]; // letter
var g_wmults = [1,1,1,2,3]; // word

var g_opponent_has_joker;   // Optimization （我就没下过 computer，给人类丢脸）

var gCloneFunc = typeof(Object.create) === "function" ? Object.create :
                 function(obj) {
                    var cl = {};
                    for (var i in obj) {
                        cl[i] = obj[i];
                    }

                    return cl;
                 };

var g_allLettersBonus = 50; // 放满 7 个 letters，加 50 score

// 通过这个来限制 computer 每一次获取分数的上限
var g_playlevel;
var g_maxwpoints = [15,30,45,50,450];


// 打乱一下
function shuffle_pool() {
    var total = g_letpool.length;
    for (var i=0; i<total; i++) {
        var rnd = Math.floor((Math.random()*total));
        var c = g_letpool[i];
        g_letpool[i] = g_letpool[rnd];
        g_letpool[rnd] = c;
    }
}



function init( iddiv ) {
    // 把 letter 扔到 g_letpool
    var numalpha = g_letters.length;

    for (var i=0; i<numalpha; i++) {

        var letinfo = g_letters[i];
        var whichlt = letinfo[0];
        var lpoints = letinfo[1];

        var numlets = letinfo[2];

        g_letscore[whichlt] = lpoints;

        for (var j=0; j<numlets; j++) {
            g_letpool.push( whichlt );
        }

    }
    // 让我们随机一下
    shuffle_pool();

    var my_letters   = "";
    var comp_letters = "";

    my_letters   = takeLetters( my_letters );
    comp_letters = takeLetters( comp_letters );

    g_bui.create( iddiv, 15, 15, g_letscore, g_racksize );

    g_bui.setPlayerRack( my_letters );
    g_bui.setOpponentRack( comp_letters );
    g_bui.setTilesLeft( g_letpool.length );
}

// 补充待补充的 letter
function takeLetters( existing ) {
    var poolsize = g_letpool.length;
    if (poolsize === 0) {
        return existing;
    }

    var needed = g_racksize - existing.length;

    if (needed > poolsize) {
        needed = poolsize;
    }

    var letters = g_letpool.slice(0, needed).join("");
    g_letpool.splice(0, needed);
    return letters + existing;
}

// 检查 player 放的 letter 的有效位置
// 一个 letter 的例子 {x, y, ltr（字母）, lscr / lsc（分数）} （妈蛋，写太多了会忘）
function checkValidPlacement( placement ) {
    if (placement.length === 0)
        return { played:"", msg:t("no letters were placed.") };
    // logit(placement);
    var isplacement = {};
    var worderrs = "";

    var lplayed = "";
    var minx = placement[0].x;
    var miny = placement[0].y;
    var maxx = minx;
    var maxy = miny;
    var dx = 0; // 方向定义，1 代表横向衍生
    var dy = 0; // 同上，1 代表竖向衍生

    // 起始位置
    var sp = g_bui.getStartXY();
    var onStar = false;

    var x,y,xy;

    for (var i = 0; i < placement.length; i++) {
        var pl = placement[i];
        if (pl.lsc === 0)
            lplayed += "*";
        else
            lplayed += pl.ltr;
        x = pl.x;
        y = pl.y;

        if (x === sp.x && y === sp.y)
            onStar = true;

        xy = x + "_" + y;
        isplacement[xy] = pl;

        // 这里是为了调整这一串字母的最大、最小位置
        if (minx > x)
            minx = x;
        if (maxx < x)
            maxx = x;

        if (miny > y)
            miny = y;
        if (maxy < y)
            maxy = y;
    }


    if (miny < maxy)
        dy = 1;

    if (minx < maxx)
        dx = 1;

    // 横向、又纵向衍生，那肯定就是斜着放了
    if (dx === 1 && dy === 1)
        return {played:"", msg:t("word must be horizontal or vertical.") };

    // 起始必须放中间
    if (g_board_empty && !onStar)
        return {played:"", msg:t("first word must be on the star.") };

    var mbx = g_board.length;
    var mby = mbx;
    // 只有一个 letter 放入了
    if (dx === 0 && dy === 0) {

        if (minx > 0 && g_board[minx-1][miny] !== "" || minx < mbx-1 && g_board[minx+1][miny] !== "") {
            dx = 1;
        }

        else if (miny > 0 && g_board[minx][miny-1] !== "" || miny < mby - 1 && g_board[minx][miny+1] !== "") {
            dy = 1;
        }

        else {
            lplayed = lplayed.toUpperCase();
            var msg = lplayed + t(" is not connected to a word.");
            return {played:"", msg:msg };
        }
    }

    var numl = (dx === 1) ? maxx-minx+1 : maxy-miny+1;
    // 起始位置
    var px = minx - dx;
    var py = miny - dy;

    var word = "";

    var wordmult = 1;
    var wscore = 0; // 新的 word 的 score
    var oscore = 0; // 与已经放了的 letter 的 score
    var ltr;
    var words = []; // 新 word + 拼的 word

    // 这里算正交的
    for (i = 0; i < numl; i++) {
        x = px + dx;
        y = py + dy;

        ltr = g_board[x][y];

        if (ltr === "") {
            return { played:"", msg:t("spaces in word.") };
        }

        xy = x + "_" + y;

        if (xy in isplacement) {
            // 检查拼的 word
            // 该字母的情况、bonus、分数
            var pinfo = isplacement[xy];

            var bonus = g_boardmults[x][y];
            var lscr  = pinfo.lsc;

            var orthinfo = getOrthWordScore( ltr, lscr, x, y, dx, dy );

            // 把 bonus 乘上（letter）
            lscr *= g_lmults[bonus];
            wscore += lscr;
            // word bonus
            wordmult *= g_wmults[bonus];

            // 拼不出来的 letter
            if ( orthinfo.score === -1 ) {
                if (worderrs !== "")
                    worderrs += ", ";
                worderrs += orthinfo.word.toUpperCase();
            }

            if (orthinfo.score > 0) {
                oscore += orthinfo.score;
                words.push(orthinfo.word);
            }
            // logit( "orthword:"+orthinfo.word+", score:"+orthinfo.score );

        }
        else
            // 最后算之前存在的 letter 的 score
            wscore += g_boardpoints[x][y];

        word += ltr;
        px += dx;
        py += dy;
    }

    // 接下来是算新加的 letter 的首字母之前的
    var xpre = minx - dx;
    var ypre = miny - dy;
    while (xpre >= 0 && ypre >= 0 && g_board[xpre][ypre] !== "") {
        ltr = g_board[xpre][ypre];
        wscore += g_boardpoints[xpre][ypre];
        word = ltr + word;
        xpre -= dx;
        ypre -= dy;
    }

    // 算新加的 letter 的尾字母之后的
    var xpst = maxx + dx;
    var ypst = maxy + dy;
    while (xpst < mbx && ypst < mby && g_board[xpst][ypst] !== "") {
        ltr = g_board[xpst][ypst];
        wscore += g_boardpoints[xpst][ypst];
        word += ltr;
        xpst += dx;
        ypst += dy;
    }

    if (!(word in g_wordmap)) {
        if (worderrs !== "")
            worderrs += ", ";
        worderrs += word.toUpperCase();
    }

    // 如果有在词典里面找不到的，抛出 error
    if (worderrs !== "") {
        worderrs += t(" not found in dictionary.");
        return { played:"", msg:worderrs };
    }

    // 限制了在第一次之后，之后的词都必须要在之前的基础上添加，不能随意放
    // 我加的这个规则真的是巨难哈哈哈哈哈哈
    if (!g_board_empty && oscore === 0 && word.length === placement.length) {

        return { played:"", msg:t("word not connected.") };
    }

    //logit( "created word is:"+ word);
    words.push( word );

    var score = wscore * wordmult + oscore;

    return { played:lplayed, score:score, words:words };
}


function onPlayerClear() {
    g_bui.cancelPlayerPlacement();
}

// 字母池没有了
function onPlayerSwap() {

    var tilesLeft = g_letpool.length;
    if (tilesLeft === 0) {
        g_bui.prompt( t("Sorry - no tiles left to swap") );
        return;
    }
    g_bui.cancelPlayerPlacement();
    g_bui.showSwapModal( tilesLeft );
}

// 执行 swap 操作，重新从字母池里面捞一些出来
function onPlayerSwapped( keep, swap ) {
    if (swap.length === 0) {
        g_bui.setPlayerRack( keep );
        g_bui.makeTilesFixed();
        return;
    }

    for (var i = 0; i < swap.length; i++) {
        g_letpool.push( swap.charAt(i) );
    }

    shuffle_pool();

    var newLetters = takeLetters( keep );
    g_bui.setPlayerRack( newLetters );

    onPlayerMoved( true );
}

// player 完成操作之后
function onPlayerMoved( passed ) {
    if (passed) {
        g_bui.cancelPlayerPlacement();
    }

    self.passed = passed;
    g_bui.showBusy();
    setTimeout( onPlayerMove, 100 );
}

// 如果 player 不下第一步，computer 下第一步的操作
function find_first_move( opponent_rack, fx, fy ) {

    var letters = opponent_rack.split("").sort();
    var foundv = false;
    var anchor = 0;
    // 找到元音
    for (var i = 0; i < letters.length; i++) {
        if (letters[i] in g_vowels) {
            foundv = true;
            anchor = i;
            break;
        }
    }
    var alet = letters[anchor];
    var aletscr = g_letscore[alet];


    // 把选出来的从候选集里面剔除
    letters.splice( anchor, 1 );

    // 先放进去进行尝试
    g_board[fx][fy] = alet;
    g_boardpoints[fx][fy] = aletscr;


    var selword = { score:-1 };

    // 然后来找 best word，分数最高的
    if (fx > 0)
        selword = findBestWord( opponent_rack, letters, fx-1, fy );

    if (selword.score === -1 && fx >= 0 && fx < g_board.length-1 )
        selword = findBestWord( opponent_rack, letters, fx+1, fy );

    if (selword.score === -1) {

        g_board[fx][fy] = "";
        g_boardpoints[fx][fy] = 0;
        return null;
    }

    // 将最先放进去尝试的 letter 也重新放入新生成的 word 中，主要是要把 score 放进去，这样才能计算分数

    if (selword.ax < fx) {
        var pos = Math.abs(fx - selword.ax);
        selword.lscrs.splice(pos, 0, aletscr);
    }

    else {
        selword.lscrs.splice(0, 0, aletscr);
    }


    selword.seq = selword.word;


    g_board[fx][fy] = "";
    g_boardpoints[fx][fy] = 0;


    selword.score += aletscr;


    return selword;
}


function find_best_move( opponent_rack ) {
    var num = opponent_rack.length;
    letters = [];
    for (var i = 0; i < num; i++) {
        letters[i] = opponent_rack.charAt(i);
    }


    var board_best_score = -1;
    var board_best_word = null;

    for ( var ax = 0; ax < g_board.length; ax++) {
        for ( var ay = 0; ay < g_board[ax].length; ay++) {
            // 确保填充的是在原始 letter 的周围
            if (g_board[ax][ay] !== "") {
                dx = [-1, 1, 0, 0];
                dy = [0, 0, 1, -1];
                for (var tmp = 0; tmp < 4; tmp++) {
                    // 进行遍历操作，获取最好的放置位置
                    if (g_board[ax+dx[tmp]][ay+dy[tmp]] === "") {
                        var word = findBestWord( opponent_rack, letters, ax+dx[tmp], ay+dy[tmp] );
                        if (word.score > -1)


                            if (board_best_score < word.score) {

                                board_best_score = word.score;
                                board_best_word = word;
                            }
                    }

                }

            }



        }
    }

    //logit( board_best_word.word );
    return board_best_word;
}


function announceWinner() {
    var oleft = g_bui.getOpponentRack();
    var pleft = g_bui.getPlayerRack();

    var odeduct = 0;
    for (var i=0; i<oleft.length; i++)
        odeduct += g_letscore[oleft.charAt(i)];

    pdeduct = 0;
    for (i=0; i<pleft.length; i++)
        pdeduct += g_letscore[pleft.charAt(i)];

    g_oscore -= odeduct;
    g_pscore -= pdeduct;

    html = t("After deducting points of unplaced tiles, score is:");
    html += "<br>";
    html += t("You:")+g_pscore+t("  Computer:")+g_oscore+"<br>";
    var msg = t("It's a draw !");
    if (g_oscore > g_pscore)
        msg = t("Computer wins.");
    else
    if (g_oscore < g_pscore)
        msg = t("You win !");
    html += "<font size='+2'>" + msg + "</font>";
    g_bui.prompt( html, "" );
}


function onPlayerMove() {
    var passed = self.passed;

    // 是否 pass 本轮
    if (passed) {

        g_passes++;

        if (g_passes >= g_maxpasses) {
            announceWinner();
            return;
        }
    }



    var boardinfo = g_bui.getBoard();
    g_board = boardinfo.board;
    g_boardpoints = boardinfo.boardp;
    g_boardmults  = boardinfo.boardm;

    if (!passed) {
        var placement = g_bui.getPlayerPlacement();  // player 本次放 letters 的信息
        var pinfo = checkValidPlacement( placement );  // 检查输入的有效性

        var pstr = pinfo.played;

        // 放 letter 失败
        if ( pstr === "" ) {
            g_bui.prompt( t("Sorry, ") + pinfo.msg );
            return;
        }

        //logit( "player placement chars:" + pstr );
        g_bui.acceptPlayerPlacement();
        g_board_empty = false;
        g_passes = 0;

        //
        if (pstr.length === g_racksize) {

            g_pscore += g_allLettersBonus;
        }


        g_pscore += pinfo.score;
        g_bui.setPlayerScore( pinfo.score, g_pscore );

        g_bui.addToHistory(pinfo.words, 1);

        //logit( "removing player chars:" + pstr );
        g_bui.removeFromRack( 1, pstr );


        // 剩余的 letter
        var pletters = g_bui.getPlayerRack();
        //logit( "left on player rack:" + pletters );

        pletters = takeLetters(pletters);

        if (pletters === "") {
            // 字母池用完了，实际上这个结束条件很难达到
            announceWinner();
            return;
        }
        //logit( "setting player rack to:" + pletters );
        g_bui.setPlayerRack( pletters );
        g_bui.setTilesLeft( g_letpool.length );
    }
    // player pass 了之后，要把 letter 放回去
    else {

        g_bui.cancelPlayerPlacement();
        //logit( "after cancel, left on player rack:" + g_bui.getPlayerRack() );
    }


    var ostr = g_bui.getOpponentRack();

    g_opponent_has_joker = ostr.search("\\*") !== -1;
    // 限制 computer 的分数
    g_playlevel = g_bui.getPlayLevel();

    // logit( "opponent rack has:" + ostr );

    var play_word;

    if ( g_board_empty ) {
        var start = g_bui.getStartXY();

        play_word = find_first_move( ostr, start.x, start.y );
    }
    else {
        play_word = find_best_move( ostr );
    }


    //logit( "opponent word is:" + play_word.word );

    var animCallback = function() {
        g_bui.makeTilesFixed();
        //g_bui.hideBusy();

        var words = play_word.owords;
        words.push( play_word.word );

        // 添加到 history 界面
        g_bui.addToHistory(words, 2);

        var score = play_word.score;

        g_oscore += score;
        if (play_word.seq.length === g_racksize) {
            g_oscore += g_allLettersBonus;
        }

        g_bui.setOpponentScore( score, g_oscore );

        var played = play_word.seq;

        var letters_used = "";
        for (i=0; i<played.length; i++) {
            var pltr = played.charAt(i);
            if (ostr.search(pltr) > -1)
                    letters_used += pltr;
                else
                    letters_used += "*";
        }
        g_bui.removeFromRack( 2, letters_used );


        var letters_left = g_bui.getOpponentRack();

        var newLetters = takeLetters(letters_left);

        if (newLetters === "") {

            announceWinner();
            return;
        }

        g_bui.setOpponentRack( newLetters );
        g_bui.setTilesLeft( g_letpool.length );
    };


    if (play_word !== null) {

        placeOnBoard( play_word, animCallback );
        g_passes = 0;
    }
    else {
        g_bui.hideBusy();

        g_passes++;

        if (g_passes >= g_maxpasses) {
            announceWinner();
        }

        else {
            g_bui.prompt( t("I pass, your turn.") );
            g_bui.makeTilesFixed();
        }
        // return;
    }

}


function findBestWord( rack, letters, ax, ay ) {


    var numlets = letters.length;

    var bestscore = -1;
    var bestword = {score:-1};
    var dirs = ["x","y"];
    for (var dir in dirs) {

        if (dirs.hasOwnProperty(dir)) {
            var xy = dirs[dir];
        }

        // logit( "direction:" + xy );
        // 获取正则表达式
        var regex = getRegex( xy, ax, ay, rack );


        if (regex !== null) {

            var word = getBestScore( regex, letters, ax, ay );

            if (bestscore < word.score) {
                bestscore = word.score;
                bestword = word;
                //logit( "new best:" );
                //logit( bestword );
            }
        }
    }


    // logit( "Time for findBestWord:"+(t2-t1) );

    return bestword;
}

function getBestScore( regex, letters, ax, ay ) {
    var rletmap = {}; // 剩余 letter 的种类和个数
    var numjokers = 0;
    for (var i = 0; i < letters.length; i++) {
        var ltr = letters[i];

        if (ltr === "*") { // just joker~
            numjokers++;
        }

        else if (!(ltr in rletmap)) {
            rletmap[ltr] = 1;
        }

        else {
            rletmap[ltr]++;
        }

    }

    var bestscore = -1;
    var bestword = { score:-1 };

    // 确保 word 的字长不超过 7
    if (regex.max - 1 >= g_wstr.length)
        return bestword;

    var regexp = new RegExp(regex.rgx, "g");
    var match, matches;
    var req_seq, word;

    for (var wlc = regex.min-2; wlc < regex.max-1; wlc++) {
        var id = regex.rgx + wlc;

        // 加快正则匹配，不需要每次都去计算
        if (id in g_matches_cache) {
            matches = g_matches_cache[id];
        }

        else {
            matches = [];
            while ((match=regexp.exec(g_wstr[wlc]))!==null) {

                // 在 g_wstr 里面逐个比较，并且最后尝试获取结果
                req_seq = "";

                for (i = 1; i < match.length; i++) {
                    // undefined 的 bug
                    if (match[i]) {
                        req_seq += match[i];
                    }

                }

                // 保留没有找到的 letter
                var mseq = match[0];

                word = mseq.substr(1, mseq.length-2);
                matches.push({word:word, reqs:req_seq});
            }

            // 做缓存
            g_matches_cache[id] = matches;
        }

        for (var j = 0; j < matches.length; j++) {


            // 尝试寻找正则表达式中的 word 所需要的那些 letter
            // 是否是在我们的没有填充的那些 letter 中有


            var seq_lscrs = [];

            req_seq = matches[j].reqs;
            word = matches[j].word;


            var letmap = gCloneFunc( rletmap );


            // 我们的 letter 是否能够拼接成为 word？
            var ok = true;
            var jokers = numjokers;

            for (i = 0; i < req_seq.length; i++) {

                var rlet = req_seq.charAt(i);

                if (rlet in letmap && letmap[rlet] > 0 ) {

                    if (letmap[rlet] > 0) {
                        letmap[rlet]--;
                        seq_lscrs.push(g_letscore[rlet]);
                    }
                    else {

                        if (jokers === 0) {

                            ok = false;
                            break;
                        }

                        jokers--; // 使用 joker，万能符
                        seq_lscrs.push(0);
                    }
                }
            }

            if (!ok) {
                continue;
            }



            //**************************************************

            var wordinfo   = { word:word, ax:ax, ay:ay };
            wordinfo.seq   = req_seq;     // letter
            wordinfo.lscrs = seq_lscrs;   // score
            wordinfo.ps    = regex.ps;    // 起始的 point，根据 xy 判断 direction
            wordinfo.xy    = regex.xy;    // direction
            wordinfo.prec  = regex.prec;  // 有没有前缀




            // 通过 getWordScore 来计算自己加上正交的 word 分数
            var score = getWordScore( wordinfo );
            //g_timers.pause( "getWordScore" );



            if (score < g_maxwpoints[g_playlevel] && bestscore < score) {
                bestscore = score;
                bestword = wordinfo;
                bestword.score = score;
            }
        }
    }
    return bestword;
}


function getWordScore( wordinfo ) {
    var xdir = (wordinfo.xy === "x");
    var ax   = wordinfo.ax;
    var ay   = wordinfo.ay;
    // var ap   = xdir ? ax : ay;
    var max = xdir ? g_board.length : g_board[ax].length;

    var dx   = xdir ? 1 : 0;
    var dy   = 1 - dx;
    var ps   = wordinfo.ps;
    var seq  = wordinfo.seq;
    var seqc = 0;
    var x;
    var y;

    //logit( "Checking orthogonals for:"+wordinfo.word+" dir:"+wordinfo.xy );
    //logit( wordinfo );

    if (xdir) {
        x = ps;
        y = ay;
    }
    else {
        x = ax;
        y = ps;
    }

    var owords = []; // 存放正交 word 的数组
    var wscore = 0;  // word score
    var oscore = 0;  // 正交 word score

    var lscores = wordinfo.lscrs;
    // var locs = "x"+x+"y"+y+"d"+wordinfo.xy;

    var wordmult  = 1;

    while (ps < max) {
        if (g_board[x][y] === "") {
            var lscr = lscores[seqc];  // 自己的 score
            var lseq = seq.charAt(seqc++);   // letter 本身

            // bonus
            var bonus = g_boardmults[x][y];


            var ows = getOrthWordScore( lseq, lscr, x, y, dx, dy );

            if (ows.score === -1) {
                return -1;
            }


            if (ows.score > 0) {
                owords.push( ows.word );
            }


            wordmult *= g_wmults[bonus];
            lscr     *= g_lmults[bonus];
            wscore   += lscr;

            oscore += ows.score;
            x += dx;
            y += dy;
            ps++;

            // 完成所有匹配
            if (seqc === seq.length) {
                break;
            }


        }
        else {

            wscore += g_boardpoints[x][y];
        }



        while (ps < max && g_board[x][y] !== "") {
            x += dx;
            y += dy;
            ps++;
        }
    }

    // logit( "word:" + wordinfo.word + ", mult:" + wordmult );
    wscore *= wordmult;

    if (seq.length === g_racksize) {
        wscore += g_allLettersBonus;
    }


    wordinfo.owords = owords;
    return wscore+oscore;
}


// lseq - letter，lscr - score，(x，y）- point，（dx，dy）- direction
// 算正交的 word 的分数
function getOrthWordScore( lseq, lscr, x, y, dx, dy ) {
    var wordmult = 1;

    var score = 0;
    var wx = x;
    var wy = y;

    var xmax = g_board.length;
    var ymax = g_board[x].length;

    // 对于之前的值，我们需要保存下来，防止被覆盖
    var lsave = g_board[wx][wy];
    var ssave = g_boardpoints[wx][wy];

    var bonus = g_boardmults[wx][wy];

    wordmult *= g_wmults[bonus];
    lscr *= g_lmults[bonus];

    g_board[wx][wy] = lseq;
    g_boardpoints[wx][wy] = lscr;



    // dx、dy 的作用就是不要把 word 自己算进去了
    // 查一圈，逆时针
    while (x >= 0 && y >= 0 && g_board[x][y] !== "") {
        x -= dy;
        y -= dx;
    }
    // 修正一圈中可能的空值
    if (x < 0 || y < 0 || g_board[x][y] === "") {
        x += dy;
        y += dx;
    }
    // 抽取所有的可能存在的 word
    var orthword = "";
    while (x < xmax && y < ymax && g_board[x][y] !== "") {
        var letter = g_board[x][y];
        score += g_boardpoints[x][y];
        orthword += letter;
        x += dy;
        y += dx;
    }

    // 算好了就可以把原来的值放回去了
    g_board[wx][wy] = lsave;
    g_boardpoints[wx][wy] = ssave;

    if (orthword.length === 1)
        // 没拼出来新的
        return {score:0, word:orthword };


    if (!(orthword in g_wordmap))
        // 这个词没找到
        return {score:-1, word:orthword };

    score *= wordmult;

    // logit( "orth word:"+ orthword + " score:" + score );
    return { score:score, word:orthword };
}


function placeOnBoard( word, animCallback ) {
    var lcount = 0;
    var seqlen = word.seq.length;
    var dx = 1;
    var dy = 0;
    if (word.xy === "y") {
        dx = 0;
        dy = 1;
    }
    var x = word.ax;
    var y = word.ay;
    var placements = [];
    while (lcount < seqlen) {
        if (g_board[x][y] === "") {
            var lscr = word.lscrs[lcount];
            var ltr  = word.seq.charAt(lcount++);
            placements.push({x:x, y:y, ltr:ltr, lscr:lscr});
            //g_bui.opponentPlay(x, y, ltr, lscr);
        }
        x += dx;
        y += dy;
    }

    g_bui.playOpponentMove( placements, animCallback );
    g_bui.hideBusy();
    g_board_empty = false;
}

// ******************************************************************************
// 通过正则表达式，来匹配所有的符合条件的 word，然后把结果返回，再利用 getBestScore 来计算
// 哪一种方案的得分是最高的
// ******************************************************************************
function getRegex( dir, ax, ay, rack ) {
    // deX........  => /de[a-z]{1,7}/g
    // ..e..m.....  => /e[a-z]{2}m[a-z]{0,3}/g
    // ...e.m..p..  => /e[a-z]m[a-z]{2}p[a-z]{0,2}/g


    var letrange = "["+rack+"]";
    if (g_opponent_has_joker) {
        letrange = g_letrange;
    }


    var numlets = rack.length;

    if (g_board[ax][ay] !== "")
        // 已经存在 letter 了
        return null;

    var xdir = (dir === "x"); // direction

    var ap = xdir ? ax : ay; // 起始点，这个要根据 direction 来选择是 ax 还是 ay

    var max = xdir ? g_board.length : g_board[ax].length; // 最大字长 15
    var dx = xdir ? 1 : 0;
    var dy = 1 - dx; // dx 和 dy 表明了 word 的衍生方向

    // *****************
    // 首先检查是否有可以做连接的的 letter，已经填好了的
    var ok = false;

    // 检查起始点左边 or 上面的 point
    var l_x = ax - dx;
    var a_y = ay - dy;
    if (ap > 0 && g_board[l_x][a_y] !== "") {
        ok = true;
    }



    // 然后开始搜索 word 的这一系列平行的位置有没有
    var sc = ap;  // sc: short for scan
    var scx = ax + dx;
    var scy = ay + dy;


    var sminpos = max;
    var empty;

    if (!ok)
        empty = 0;
        while (sc < max - 1) {
            if ( g_board[scx][scy] !== "" ) {
                ok = true;
                break;
            }
            else
                empty++;

            if (empty > numlets)

                break;

            a_y = scy - dx;  // x above y
            l_x = scx - dy;  // y left of x

            var b_y = scy + dx;  // x below y
            var r_x = scx + dy;  // y right of x
            if ( l_x >= 0 && a_y >= 0 && g_board[l_x][a_y] !== "" || r_x < max && b_y < max && g_board[r_x][b_y] !== "" ) {
                sminpos = sc + 1;
                ok = true;
                break;
            }

            scx += dx;
            scy += dy;
            sc++;
        }

    if (!ok)
        // 找不到可以已经存在的 letter
        return null;

    // ***************** 1. end

    // ***************** 2. start
    // 找到第一个放置位置之前的空 letter
    var ps = ap - 1;
    var xs = ax - dx;
    var ys = ay - dy;
    while (ps >= 0 && g_board[xs][ys] !== "") {
        xs -= dx;
        ys -= dy;
        ps--;
    }

    if (ps < 0) {
        ps = 0;
        if (xs < 0) {
            xs = 0;
        }

        else if (ys < 0) {
            ys = 0;
        }
    }
    // prev 变量包含了所有紧邻目标 letter 的 其他 letter，左或者上
    var prev = "";
    for (var i = ps; i < ap; i++) {
        prev += g_board[xs][ys];
        xs += dx;
        ys += dy;
    }

    // ***************** 2. end

    // ***************** 3. start
    // 用正则表达式来计算可能的 word、最小最大字长、起始位置
    // 其实这是一个伪正则表达式，因为所有的可能的 word 都存放在 xx_wordlist.js 里面的 g_wstr 变量
    // 存放方法是 _"word"_ 这样隔开然后成为一个 string，同时不同字长的 word 是分开的 string

    var x = ax;
    var y = ay;
    var p = ap;

    var mws = mwe = "_"; // "^" 和 "$"
    var regex = mws + prev; // 正则
    var regex2 = "";
    var letters = 0;
    var blanks  = 0; // 记录有多少可以填充的空 point

    var minl    = 0; // 最小字长
    var minplay = 1;

    var countpost; // 控制是否可以添加额外的 letter，用来控制计数的

    var prevlen = prev.length;

    var flpos = ap;
    var l;

    while ( p < max ) {

        l = g_board[x][y];
        if (l === "") { // 该 point 为空

            // 如果之前有 letter
            if (p === ap && prevlen > 0) {
                minl = prevlen + 1;

                countpost = true;
            }
            else
                countpost = false;


            blanks++;

            if (letters === numlets) {
                break;
            }


            letters++;
        }
        else {
            hadletters = true;

            // 就是看当前点的前面、后面能不能够再填入 letter
            // 举个例子来说明这里在干嘛
            // ..ad..sing
            // ..adD.sing 和 ..adVIsing 都是可以的
            // 所以正则表达式就是 _ad([a-z]{1})_  or _ad([a-z]{2})sing_
            if (blanks > 0) {
                regex += "(" + letrange;
                // 如果能填入的空不止一个，就需要生成 ([a-z]{1}){1} 格式
                if (blanks > 1) {

                    if (prev !== "") {
                        regex2 = "|" + regex;
                        // 不止两个，就需要生成 ([a-z]{1}){1, X} 格式
                        if (blanks > 2)
                            regex2 += "{1," + (blanks-1) + "}";
                        regex2 += ")" + mwe;
                    }
                    regex += "{" + blanks + "}";
                }
                regex += ")";
                if (minl === 0) {
                    minl = prevlen + blanks;

                    countpost = true;
                }
                if (countpost && flpos === ap)
                    // 存起始点位置
                    flpos = p;
                blanks = 0;
            }
            regex += l;
            if (countpost) {
                minl++;
            }

            minplay = 0;
        }
        x += dx;
        y += dy;
        p++;
    }

    if (blanks > 0) {
        // 最后位置是空的
        regex += "(" + letrange;

        // 到边缘了
        if (p === max) {
            regex += "{"+minplay+","+blanks+"}";
        }

        else {
            // 根据最后一个 point 有没有 letter 来添加成为不同的情况

            // ..ad... 没有结尾的
            if (g_board[x][y] === "") {
                regex += "{" + minplay + "," + blanks + "}";
            }
            // ..ad..X 结尾还有一个或多个的
            else {
                regex += "{" + blanks + "}";
                for (i = p + 1; i < max; i++) {

                    l = g_board[x][y];

                    if (l === "") {
                        break;
                    }
                    regex += l;
                    x += dx;
                    y += dy;
                }
            }
        }
        regex += ")";
    }

    // flpos - 第一个 letter 的位置
    //         when generating the regex
    // sminpos - 平行的第一个 letter
    // logit( "flpos="+flpos+", sminpos="+sminpos );

    // 修正了 最小、最大字长
    if (flpos === ap) {

        // 判断当前 point 之前是否还有 letter
        if (prev !== "") {
            minl = prevlen + 1;
        }

        else {
            minl = sminpos - ap + 1;
        }
    }




    else {
        var mindiff = flpos - sminpos;

        if ( mindiff > 1 )


            minl -= mindiff;
    }

    var s = ap - prev.length;
    var maxl = p-s;

    // 其他可能的正则表达式
    regex += mwe + regex2;

    // return 例子: {rgx: "_am[a-z]{2}t_", xs: 0, min: 3, max: 5, prf: "am"}

    var res  = { rgx:regex, ps:s, min:minl, max:maxl };
    res.prec = prev;
    res.xy   = dir;

    return res;
}

window["init"] = init;
