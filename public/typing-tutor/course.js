'use strict';
const COURSE = [
['Home row: left hand','ASDF','Rest your left little, ring, middle and index fingers on A, S, D and F.', ['aaa sss ddd fff asdf fdsa asdf fdsa','as sa sd ds df fd af fa sad fad ads dads','asdf fdsa asdf fdsa sad fad dads adds sad fad']],
['Home row: right hand','JKL;','Rest your right index, middle, ring and little fingers on J, K, L and semicolon.', ['jjj kkk lll ;;; jkl; ;lkj jkl; ;lkj','jk kj kl lk l; ;l jl lj j; ;j jkl; ;lkj','jj kk ll ;; jk kl l; ;l lk kj jkl; ;lkj']],
['Home row: both hands','ASDF JKL;','Use the raised marks on F and J to find home without looking down.', ['asdf jkl; fdsa ;lkj asdf jkl; fdsa ;lkj','af sj dk fl aj sk dl f; fj dk sl a;','sad lad flask fall salad ask lads flask; ask dad;']],
['Reach to G and H','G H','Both index fingers reach inward. Left index uses G; right index uses H.', ['fgf jhj fgf jhj fggf jhhj gh hg gh hg','gag hag shag glass glad hall half flag','a glad lad; a glass flask; dad has a flag;']],
['Upper row: left hand','Q W E R T','Reach upward with your left hand, then return to ASDF.', ['aqa sws ded frf ftf qwer trew qwert','we were tree read red weed water trade','we read; we trade; dad sees a red tree;']],
['Upper row: right hand','Y U I O P','Use the right index for Y and U, middle for I, ring for O, and little for P.', ['jyj juj kik lol ;p; yuiop poiuy','you your up oil pool pillow pupil pure','you read your paper; pour water; use your guide;']],
['Upper and home rows','TWO ROWS','Keep your wrists relaxed and bring each finger back to its home key.', ['qwerty uiop asdfgh jkl; qwerty uiop','read write guide type quiet power study','we study with a guide; your skills grow as you type;']],
['Lower row: left hand','Z X C V B','Use left little for Z, ring for X, middle for C, and index for V and B.', ['aza sxs dcd fvf fbf zxcvb bvcxz','zebra extra cave brave box exact back','a brave zebra; a black box; a very exact answer;']],
['Lower row: right hand','N M , . /','Right index uses N and M. Reach down gently for comma, period and slash.', ['jnj jmj k,k l.l ;/; nm,./ /.,mn','man moon name, line. minimum, normal.','a calm man, a clear mind. learn more, one line at a time.']],
['All letter rows','A–Z','Use all three rows. Aim for smooth movements before increasing speed.', ['the quick brown fox jumps over the lazy dog.','pack my box with five dozen liquor jugs.','a quick mind learns from steady practice. type slowly, then build speed.']],
['Capital letters','SHIFT','Hold Shift with the opposite hand to the letter you are typing.', ['Aa Ss Dd Ff Jj Kk Ll Qq Ww Ee Rr Tt Yy Uu Ii Oo Pp','MindKosh Pixora. Learn Today. Prepare Better.','I learn a little every day. A Good Habit Builds A Better Future.']],
['Numbers: left hand','1 2 3 4 5','Left little uses 1, ring uses 2, middle uses 3, and index uses 4 and 5.', ['a1a s2s d3d f4f f5f 12345 54321','11 22 33 44 55 12 23 34 45 15 51','Read 12 pages. Write 34 words. Practice for 15 minutes.']],
['Numbers: right hand','6 7 8 9 0','Right index uses 6 and 7, middle uses 8, ring uses 9, and little uses 0.', ['j6j j7j k8k l9l ;0; 67890 09876','66 77 88 99 00 67 78 89 90 60 06','Room 67 has 80 books. Page 90 has 6 useful tips.']],
['Numbers in everyday use','0–9','Keep your hands anchored while reaching for the number row.', ['1234567890 0987654321 13579 24680','Item 12 costs 450. Order 37 contains 80 pens.','Practice 5 days a week for 20 minutes. Track 100 words in 2 minutes.']],
['Punctuation and Enter','PUNCTUATION','Use your right little finger for Enter. Press Enter at the end of each line.', ['one, two, three. stop; start. why? yes!','Hello, learner!\nKeep going.\nYou are doing well.','Take your time; accuracy matters.\nRead, type, review.\nTry again!']],
['Symbols and Shift','! @ # $ % ^ & * ( )','For shifted symbols, hold Shift with the opposite hand.', ['1! 2@ 3# 4$ 5% 6^ 7& 8* 9( 0)','!@#$% ^&*() !@#$% ^&*()','Save 25%! Price: $40. Item #3 costs $8 (tax: 5%).']],
['Brackets and special keys','[ ] { } + =','Use the US keyboard layout. The guide shows the key and the required Shift.', ['[] {} () <> - _ = + \\ | ` ~','[one] {two} (three) <four> x=5 y+2','user_name = "Pixora";\npath = "C:\\notes";\n[10 + 20] = 30']],
['Word rhythm','COMMON WORDS','Press Space with a thumb. Keep a steady rhythm between words.', ['the and for with from your this that have will can learn','learn think build create focus steady skill clear calm confident','small steps build good habits and good habits help us reach our goals']],
['Sentence practice','READ · TYPE · REVIEW','Read a few words ahead. Use Backspace to correct errors and keep going.', ['A quiet mind and a steady rhythm make practice easier.','Accuracy comes first. Speed follows when your hands know the way.','MindKosh Pixora helps you practice one skill at a time. Keep your eyes on the text and let your fingers do the work.']],
['Final practice','PUT IT ALL TOGETHER','Bring letters, capitals, numbers and punctuation together. Complete all three drills.', ['My goal: 95% accuracy, 30 WPM, and 20 minutes of daily practice.','Day 1: Learn the home row.\nDay 2: Reach for new keys.\nDay 3: Review, improve, repeat!','Hello, future typist! You have reached Lesson 20. Your next step is simple: practice with care, track your progress, and keep learning. Good work!']]
].map((l,i)=>({id:i,title:l[0],keys:l[1],tip:l[2],drills:l[3]}));
const KEY_ROWS = [
[['`','~'],['1','!'],['2','@'],['3','#'],['4','$'],['5','%'],['6','^'],['7','&'],['8','*'],['9','('],['0',')'],['-','_'],['=','+'],['Backspace','',1.7]],
[['Tab','',1.4],['q'],['w'],['e'],['r'],['t'],['y'],['u'],['i'],['o'],['p'],['[','{'],[']','}'],['\\','|']],
[['Caps','',1.7],['a'],['s'],['d'],['f'],['g'],['h'],['j'],['k'],['l'],[';',':'],["'",'"'],['Enter','',2]],
[['ShiftLeft','',2.2],['z'],['x'],['c'],['v'],['b'],['n'],['m'],[',','<'],['.','>'],['/','?'],['ShiftRight','',2.2]],
[['Ctrl','',1.3],['Alt','',1.3],[' ','',7],['AltRight','',1.3],['CtrlRight','',1.3]]
];
const FINGER_GROUPS={'left-little':'`1qaz','left-ring':'2wsx','left-middle':'3edc','left-index':'45rtfgvb','right-index':'67yuhjnm','right-middle':'8ik,','right-ring':'9ol.','right-little':"0p;/-=[]\\'"};
function keyGuide(char){
 if(char===' ')return{key:' ',finger:'right-thumb',shift:null,label:'Space'};
 if(char==='\n')return{key:'Enter',finger:'right-little',shift:null,label:'Enter'};
 let key=char,shift=false;
 for(const row of KEY_ROWS)for(const k of row){if(k[1]===char&&char){key=k[0];shift=true;}}
 if(/[A-Z]/.test(char)){key=char.toLowerCase();shift=true;}
 const finger=Object.keys(FINGER_GROUPS).find(f=>FINGER_GROUPS[f].includes(key))||'right-little';
 return{key,finger,shift:shift?(finger.startsWith('left')?'ShiftRight':'ShiftLeft'):null,label:char};
}
function calculate(typed,target,attempts,correctAttempts,elapsed){
 const correct=[...typed].reduce((n,c,i)=>n+(c===target[i]?1:0),0);
 return{correct,wrong:typed.length-correct,accuracy:attempts?Math.round(correctAttempts/attempts*100):null,wpm:elapsed>0?Math.round(correct/5/(elapsed/60000)):0};
}
if(typeof module!=='undefined')module.exports={COURSE,KEY_ROWS,keyGuide,calculate};
