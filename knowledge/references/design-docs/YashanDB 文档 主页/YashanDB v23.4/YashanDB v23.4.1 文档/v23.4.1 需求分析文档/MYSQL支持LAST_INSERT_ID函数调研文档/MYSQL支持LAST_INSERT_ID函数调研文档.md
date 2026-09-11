Created by 冯皓博, last modified on 十一月 08, 2024

  [https://pingcode.yasdb.com/pjm/items/670e12b7e489dd0868f7b1bb](https://pingcode.yasdb.com/pjm/items/670e12b7e489dd0868f7b1bb)    ?    
  #YDBRD-34208 【mysql兼容】兼容与MYSQL LAST_INSERT_ID函数规格

  [https://dev.mysql.com/doc/refman/8.0/en/information-functions.html#function_last-insert-id](https://dev.mysql.com/doc/refman/8.0/en/information-functions.html#function_last-insert-id)  

  


yashan同名函数：

  [YDBRD-29536 : LAST_INSERT_ID() 调研](https://conf.yasdb.com/pages/viewpage.action?pageId=156113147)  

  [YDBRD-29536 : LAST_INSERT_ID() DESIGN](https://conf.yasdb.com/display/YASDOC/YDBRD-29536+%3A+LAST_INSERT_ID%28%29+DESIGN)  

### 一、参数如何影响返回值类型：

入参0个：会话开始时值为0，返回BIGINT UNSIGNED (64-bit)，表名和AUTO_INCREMENT column联动产生，如果查询前没有插入AUTO_INCREMENT列，那么值一直为0

入参1个：返回integer/bigint unsigned，输入NULL返回NULL。输入其他数值会转换成整型（浮点数四舍五入）。

同时此输入值会作为下一次LAST_INSERT_ID函数的返回值

这个1入参的功能主要用于模拟sequence：

1. Create a table to hold the sequence counter and initialize it:
1. Use the table to generate sequence numbers like this:


```
<span class="token prompt" style="color: rgb(166,127,89);">mysql&gt;</span> <span class="token keyword" style="color: rgb(0,119,170);">CREATE</span> <span class="token keyword" style="color: rgb(0,119,170);">TABLE</span> sequence <span class="token punctuation" style="color: rgb(153,153,153);">(</span>id <span class="token datatype" style="color: rgb(131,70,137);">INT</span> <span class="token operator" style="color: rgb(166,127,89);">NOT</span> <span class="token boolean" style="color: rgb(153,0,85);">NULL</span><span class="token punctuation" style="color: rgb(153,153,153);">)</span><span class="token punctuation" style="color: rgb(153,153,153);">;</span>
<span class="token prompt" style="color: rgb(166,127,89);">mysql&gt;</span> <span class="token keyword" style="color: rgb(0,119,170);">INSERT</span> <span class="token keyword" style="color: rgb(0,119,170);">INTO</span> sequence <span class="token keyword" style="color: rgb(0,119,170);">VALUES</span> <span class="token punctuation" style="color: rgb(153,153,153);">(</span><span class="token number" style="color: rgb(153,0,85);">0</span><span class="token punctuation" style="color: rgb(153,153,153);">)</span><span class="token punctuation" style="color: rgb(153,153,153);">;</span>
```

```
<span class="token prompt" style="color: rgb(166,127,89);">mysql&gt;</span> <span class="token keyword" style="color: rgb(0,119,170);">UPDATE</span> sequence <span class="token keyword" style="color: rgb(0,119,170);">SET</span> id<span class="token operator" style="color: rgb(166,127,89);">=</span><span class="token function" style="color: rgb(221,74,104);">LAST_INSERT_ID</span><span class="token punctuation" style="color: rgb(153,153,153);">(</span>id<span class="token operator" style="color: rgb(166,127,89);">+</span><span class="token number" style="color: rgb(153,0,85);">1</span><span class="token punctuation" style="color: rgb(153,153,153);">)</span><span class="token punctuation" style="color: rgb(153,153,153);">;</span>
<span class="token prompt" style="color: rgb(166,127,89);">mysql&gt;</span> <span class="token keyword" style="color: rgb(0,119,170);">SELECT</span> <span class="token function" style="color: rgb(221,74,104);">LAST_INSERT_ID</span><span class="token punctuation" style="color: rgb(153,153,153);">(</span><span class="token punctuation" style="color: rgb(153,153,153);">)</span><span class="token punctuation" style="color: rgb(153,153,153);">;</span>
```

返回值：

|场景|返回值|
|---|---|
|drop table if exists ta;,create table ta as select LAST_INSERT_ID() a;,desc ta;|bigint(21) unsigned|
|drop table if exists tb;,create table tb as select LAST_INSERT_ID(1) b;,desc tb;|int(1) unsigned|
|drop table if exists tc;,create table tc as select LAST_INSERT_ID(123123) c;    
  desc tc;|int(6) unsigned|
|drop table if exists td;,create table td as select LAST_INSERT_ID(NULL) d;,desc td;|int(0) unsigned|
|drop table if exists te;,create table te as select LAST_INSERT_ID(1.4) e;,desc te;|int(4) unsigned|
|drop table if exists tf;,drop table if exists test_decimal;,create table test_decimal(col1 decimal(8,2));,create table tf as select LAST_INSERT_ID(col1) f from test_decimal;,desc tf;|int(10) unsigned|
|drop table if exists tf;,drop table if exists test_decimal;,create table test_decimal(col1 decimal(9,2));,create table tf as select LAST_INSERT_ID(col1) f from test_decimal;,desc tf;|int(11) unsigned|
|drop table if exists tf;,drop table if exists test_decimal;,create table test_decimal(col1 decimal(10,2));,create table tf as select LAST_INSERT_ID(col1) f from test_decimal;,desc tf;|bigint(12) unsigned|
|drop table if exists tf;,drop table if exists test_decimal;,create table test_decimal(col1 decimal(11,2));,create table tf as select LAST_INSERT_ID(col1) f from test_decimal;,desc tf;|bigint(13) unsigned|
|drop table if exists tf;,drop table if exists test_decimal;,create table test_decimal(col1 decimal(17,2));,create table tf as select LAST_INSERT_ID(col1) f from test_decimal;,desc tf;|bigint(19) unsigned|
|drop table if exists tf;,drop table if exists test_decimal;,create table test_decimal(col1 decimal(18,2));,create table tf as select LAST_INSERT_ID(col1) f from test_decimal;,desc tf;|bigint(20) unsigned|
|drop table if exists tf;,drop table if exists test_decimal;,create table test_decimal(col1 decimal(19,2));,create table tf as select LAST_INSERT_ID(col1) f from test_decimal;,desc tf;|bigint(21) unsigned|
|drop table if exists tf;,drop table if exists test_decimal;,create table test_decimal(col1 decimal(30,2));,create table tf as select LAST_INSERT_ID(col1) f from test_decimal;,desc tf;|bigint(32) unsigned|
|drop table if exists te;,create table te as select LAST_INSERT_ID(1.2312312324) e;,desc te;|bigint(13) unsigned|
|drop table if exists tf;,drop table if exists test_decimal;,create table test_decimal(col1 bigint(10));,create table tf as select LAST_INSERT_ID(col1) f from test_decimal;,desc tf;|bigint(20) unsigned|
|drop table if exists tf;,drop table if exists test_decimal;,create table test_decimal(col1 bigint(1));,create table tf as select LAST_INSERT_ID(col1) f from test_decimal;,desc tf;|bigint(20) unsigned|
|drop table if exists tf;,drop table if exists test_decimal;,create table test_decimal(col1 bigint(21));,create table tf as select LAST_INSERT_ID(col1) f from test_decimal;,desc tf;|bigint(21) unsigned|
|drop table if exists tf;,drop table if exists test_decimal;,create table test_decimal(col1 bigint(255));,create table tf as select LAST_INSERT_ID(col1) f from test_decimal;,desc tf;|  
|
|drop table if exists tf;,drop table if exists test_decimal;,create table test_decimal(col1 int(1));,create table tf as select LAST_INSERT_ID(col1) f from test_decimal;,desc tf;|int(11) unsigned|
|drop table if exists tf;,drop table if exists test_decimal;,create table test_decimal(col1 int(100));,create table tf as select LAST_INSERT_ID(col1) f from test_decimal;,desc tf;|bigint(100) unsigned|
|drop table if exists tf;,drop table if exists test_decimal;,create table test_decimal(col1 int(11));,create table tf as select LAST_INSERT_ID(col1) f from test_decimal;,desc tf;|int(11) unsigned|
|drop table if exists tf;,drop table if exists test_decimal;,create table test_decimal(col1 int(12));,create table tf as select LAST_INSERT_ID(col1) f from test_decimal;,desc tf;|bigint(12) unsigned|
|drop table if exists tf;,drop table if exists test_decimal;,create table test_decimal(col1 double(100, 15));,create table tf as select LAST_INSERT_ID(col1) f from test_decimal;,desc tf;|bigint(100) unsigned|
|drop table if exists tf;,drop table if exists test_decimal;,create table test_decimal(col1 double(20, 15));,create table tf as select LAST_INSERT_ID(col1) f from test_decimal;,desc tf;|bigint(20) unsigned|
|drop table if exists tf;,drop table if exists test_decimal;,create table test_decimal(col1 double(19, 15));,create table tf as select LAST_INSERT_ID(col1) f from test_decimal;,desc tf;|bigint(19) unsigned|
|drop table if exists tf;,drop table if exists test_decimal;,create table test_decimal(col1 double(12, 5));,create table tf as select LAST_INSERT_ID(col1) f from test_decimal;,desc tf;|bigint(12) unsigned|
|drop table if exists tf;,drop table if exists test_decimal;,create table test_decimal(col1 double(11, 5));,create table tf as select LAST_INSERT_ID(col1) f from test_decimal;,desc tf;|int(11) unsigned|
|drop table if exists tf;,drop table if exists test_decimal;,create table test_decimal(col1 double(10, 5));,create table tf as select LAST_INSERT_ID(col1) f from test_decimal;,desc tf;|int(10) unsigned|
|drop table if exists tf;,drop table if exists test_decimal;,create table test_decimal(col1 float(10, 5));,create table tf as select LAST_INSERT_ID(col1) f from test_decimal;,desc tf;|int(10) unsigned|
|drop table if exists tf;,drop table if exists test_decimal;,create table test_decimal(col1 float(11, 5));,create table tf as select LAST_INSERT_ID(col1) f from test_decimal;,desc tf;|int(11) unsigned|
|drop table if exists tf;,drop table if exists test_decimal;,create table test_decimal(col1 float(12, 5));,create table tf as select LAST_INSERT_ID(col1) f from test_decimal;,desc tf;|bigint(12) unsigned|
|drop table if exists tf;,drop table if exists test_decimal;,create table test_decimal(col1 float(53));,create table tf as select LAST_INSERT_ID(col1) f from test_decimal;,desc tf;|bigint(22) unsigned|
|drop table if exists tf;,drop table if exists test_decimal;,create table test_decimal(col1 float(15));,create table tf as select LAST_INSERT_ID(col1) f from test_decimal;,desc tf;|bigint(12) unsigned|
|drop table if exists tf;,drop table if exists test_decimal;,create table test_decimal(col1 float(1));,create table tf as select LAST_INSERT_ID(col1) f from test_decimal;,desc tf;|bigint(12) unsigned|
|drop table if exists tf;,drop table if exists test_decimal;,create table test_decimal(col1 varchar(200));,create table tf as select LAST_INSERT_ID(col1) f from test_decimal;,desc tf;|bigint(800) unsigned|
|drop table if exists tf;,drop table if exists test_decimal;,create table test_decimal(col1 varchar(20));,create table tf as select LAST_INSERT_ID(col1) f from test_decimal;,desc tf;|bigint(80) unsigned|
|drop table if exists tf;,drop table if exists test_decimal;,create table test_decimal(col1 varchar(3));,create table tf as select LAST_INSERT_ID(col1) f from test_decimal;,desc tf;|int(9) unsigned|
|drop table if exists tf;,drop table if exists test_decimal;,create table test_decimal(col1 varchar(4));,create table tf as select LAST_INSERT_ID(col1) f from test_decimal;,desc tf;|bigint(12) unsigned|
|drop table if exists tf;,drop table if exists test_decimal;,create table test_decimal(col1 tinyint(1));,create table tf as select LAST_INSERT_ID(col1) f from test_decimal;,desc tf;|int(4) unsigned|
|drop table if exists tf;,drop table if exists test_decimal;,create table test_decimal(col1 tinyint(3));,create table tf as select LAST_INSERT_ID(col1) f from test_decimal;,desc tf;|int(4) unsigned|
|drop table if exists tf;,drop table if exists test_decimal;,create table test_decimal(col1 tinyint(4));,create table tf as select LAST_INSERT_ID(col1) f from test_decimal;,desc tf;|int(4) unsigned|
|drop table if exists tf;,drop table if exists test_decimal;,create table test_decimal(col1 tinyint(5));,create table tf as select LAST_INSERT_ID(col1) f from test_decimal;,desc tf;|int(5) unsigned|
|drop table if exists tf;,drop table if exists test_decimal;,create table test_decimal(col1 tinyint(11));,create table tf as select LAST_INSERT_ID(col1) f from test_decimal;,desc tf;|int(11) unsigned|
|drop table if exists tf;,drop table if exists test_decimal;,create table test_decimal(col1 tinyint(12));,create table tf as select LAST_INSERT_ID(col1) f from test_decimal;,desc tf;|bigint(12) unsigned|
|drop table if exists tf;,drop table if exists test_decimal;,create table test_decimal(col1 tinyint(100));,create table tf as select LAST_INSERT_ID(col1) f from test_decimal;,desc tf;|bigint(100) unsigned|
|drop table if exists tf;,drop table if exists test_decimal;,create table test_decimal(col1 smallint(5));,create table tf as select LAST_INSERT_ID(col1) f from test_decimal;,desc tf;|int(6) unsigned|
|drop table if exists tf;,drop table if exists test_decimal;,create table test_decimal(col1 smallint(6));,create table tf as select LAST_INSERT_ID(col1) f from test_decimal;,desc tf;|int(6) unsigned|
|drop table if exists tf;,drop table if exists test_decimal;,create table test_decimal(col1 smallint(7));,create table tf as select LAST_INSERT_ID(col1) f from test_decimal;,desc tf;|int(7) unsigned|
|drop table if exists tf;,drop table if exists test_decimal;,create table test_decimal(col1 smallint(11));,create table tf as select LAST_INSERT_ID(col1) f from test_decimal;,desc tf;|int(11) unsigned|
|drop table if exists tf;,drop table if exists test_decimal;,create table test_decimal(col1 smallint(12));,create table tf as select LAST_INSERT_ID(col1) f from test_decimal;,desc tf;|bigint(12) unsigned|
|drop table if exists tf;,drop table if exists test_decimal;,create table test_decimal(col1 smallint(100));,create table tf as select LAST_INSERT_ID(col1) f from test_decimal;,desc tf;|bigint(100) unsigned|
|drop table if exists tf;,drop table if exists test_decimal;,create table test_decimal(col1 mediumint(7));,create table tf as select LAST_INSERT_ID(col1) f from test_decimal;,desc tf;|int(9) unsigned|
|drop table if exists tf;,drop table if exists test_decimal;,create table test_decimal(col1 DATE);,create table tf as select LAST_INSERT_ID(col1) f from test_decimal;,desc tf;|int(10) unsigned|
|drop table if exists tf;,drop table if exists test_decimal;,create table test_decimal(col1 datetime(6));,create table tf as select LAST_INSERT_ID(col1) f from test_decimal;,desc tf;|bigint(26) unsigned|
|drop table if exists tf;,drop table if exists test_decimal;,create table test_decimal(col1 datetime(0));,create table tf as select LAST_INSERT_ID(col1) f from test_decimal;,desc tf;|bigint(19) unsigned|
|drop table if exists tf;,drop table if exists test_decimal;,create table test_decimal(col1 datetime(1));,create table tf as select LAST_INSERT_ID(col1) f from test_decimal;,desc tf;|bigint(21) unsigned|
|drop table if exists tf;,drop table if exists test_decimal;,create table test_decimal(col1 time(1));,create table tf as select LAST_INSERT_ID(col1) f from test_decimal;,desc tf;|bigint(12) unsigned|
|drop table if exists tf;,drop table if exists test_decimal;,create table test_decimal(col1 time(0));,create table tf as select LAST_INSERT_ID(col1) f from test_decimal;,desc tf;|int(10) unsigned|
|drop table if exists tf;,drop table if exists test_decimal;,create table test_decimal(col1 time(6));,create table tf as select LAST_INSERT_ID(col1) f from test_decimal;,desc tf;|bigint(17) unsigned|
|drop table if exists tf;,drop table if exists test_decimal;,create table test_decimal(col1   TIMESTAMP  (6));,create table tf as select LAST_INSERT_ID(col1) f from test_decimal;,desc tf;|bigint(26) unsigned|
|drop table if exists tf;,drop table if exists test_decimal;,create table test_decimal(col1   TIMESTAMP  (0));,create table tf as select LAST_INSERT_ID(col1) f from test_decimal;,desc tf;|bigint(19) unsigned|
|drop table if exists tf;,drop table if exists test_decimal;,create table test_decimal(col1 BOOLEAN);,create table tf as select LAST_INSERT_ID(col1) f from test_decimal;,desc tf;|int(4) unsigned|
|drop table if exists tf;,drop table if exists test_decimal;,create table test_decimal(col1 binary(10));,create table tf as select LAST_INSERT_ID(col1) f from test_decimal;,desc tf;|int(10) unsigned|
|drop table if exists tf;,drop table if exists test_decimal;,create table test_decimal(col1 binary(20));,create table tf as select LAST_INSERT_ID(col1) f from test_decimal;,desc tf;|bigint(20) unsigned|
|drop table if exists tf;,drop table if exists test_decimal;,create table test_decimal(col1 varbinary(20));,create table tf as select LAST_INSERT_ID(col1) f from test_decimal;,desc tf;|bigint(20) unsigned|
|drop table if exists tf;,drop table if exists test_decimal;,create table test_decimal(col1 varbinary(9));,create table tf as select LAST_INSERT_ID(col1) f from test_decimal;,desc tf;|int(9) unsigned|
|drop table if exists tf;,drop table if exists test_decimal;,create table test_decimal(col1 varbinary(1));,create table tf as select LAST_INSERT_ID(col1) f from test_decimal;,desc tf;|int(1) unsigned|
|drop table if exists tf;,drop table if exists test_decimal;,create table test_decimal(col1 blob);,create table tf as select LAST_INSERT_ID(col1) f from test_decimal;,desc tf;|bigint(65535) unsigned|
|drop table if exists tf;,drop table if exists test_decimal;,create table test_decimal(col1 tinyblob);,create table tf as select LAST_INSERT_ID(col1) f from test_decimal;,desc tf;|bigint(255) unsigned|
|drop table if exists tf;,drop table if exists test_decimal;,create table test_decimal(col1 longblob);,create table tf as select LAST_INSERT_ID(col1) f from test_decimal;,desc tf;|非法|
|drop table if exists tf;,drop table if exists test_decimal;,create table test_decimal(col1 longtext);,create table tf as select LAST_INSERT_ID(col1) f from test_decimal;,desc tf;|  
|
|drop table if exists tf;,drop table if exists test_decimal;,create table test_decimal(col1 longtext);,create table tf as select LAST_INSERT_ID(col1) f from test_decimal;,desc tf;|  
|
|drop table if exists tf;,drop table if exists test_decimal;,create table test_decimal(col1 tinytext);,create table tf as select LAST_INSERT_ID(col1) f from test_decimal;,desc tf;|bigint(765) unsigned|


```
SELECT COLUMN_NAME, NUMERIC_PRECISION, NUMERIC_SCALE
FROM information_schema.columns
WHERE table_schema = 'mysql_utf8' AND table_name = 'tf';
```

入参和返回值的关系：

|类型|有关/无关|返回值|是否同步|
|---|---|---|---|
|decimal(precision, scale)|和precision有关,和scale无关|precision+2>11：bigint(precision+2) unsigned,precision+2<=11：int(precision+2) unsigned|默认bigint(22)|
|bigint(显示宽度)|和显示宽度有关|显示宽度>20：bigint(显示宽度) unsigned,显示宽度<=20：bigint(20) unsigned|默认bigint(22)|
|int(显示宽度)|和显示宽度有关|显示宽度>11：bigint(显示宽度) unsigned,显示宽度<=11：int(11) unsigned|默认bigint(22)|
|double(precision, scale)|和precision有关,和scale无关|precision>11：bigint(precision) unsigned ,precision<=11：int(precision) unsigned|默认bigint(22)|
|float(precision, scale)|和precision有关,和scale无关|precision>11：bigint(precision) unsigned ,precision<=11：int(precision) unsigned|默认bigint(22)|
|float(precision)|和precision有关|0~24类型为float：bigint(12) unsigned,25~53类型为double：bigint(22) unsigned|默认bigint(22)|
|string(char_len)|和char_len有关|max_char_len*M>11：bigint(char_len*max_char_len) unsigned ,max_char_len*M<=11：int(char_len*max_char_len) unsigned|默认bigint(22)|
|BINARY[(M)]|和M有关|M>11：bigint(M) unsigned ,M<=11：int(M) unsigned|默认bigint(22)|
|TINYINT  [(M)]|和M有关|M>11：bigint(M) unsigned ,M<=11：int(M) unsigned,M<=4：int(4) unsigned|默认bigint(22)|
|SMALLINT  [(M)]|和M有关|M>11：bigint(M) unsigned ,M<=11：int(M) unsigned,M<=6：int(6) unsigned|默认bigint(22)|
|MEDIUMINT  [(M)]|和M有关|M>11：bigint(M) unsigned ,M<=11：int(M) unsigned,M<=9：int(6) unsigned|默认bigint(22)|
|BOOLEAN|  
|int(4) unsigned|默认bigint(22)|
|DATE|  
|int(10) unsigned|默认bigint(22)|
|DATETIME  [(fsp)]|和fsp有关|fsp = 0：bigint(19) unsigned,0<fsp<6：bigint(fsp+20) unsigned|默认bigint(22)|
|TIME  [(fsp)]|和fsp有关|fsp = 0：int(10) unsigned,0<fsp<6：bigint(11+fsp) unsigned|默认bigint(22)|
|TIMESTAMP  [(fsp)]|和fsp有关|fsp = 0：bigint(19) unsigned,0<fsp<6：bigint(fsp+20) unsigned|默认bigint(22)|
|BLOB|  
|bigint(65535) unsigned|默认bigint(22)|
|LONGBLOB|  
|不支持|默认bigint(22)|
|TINYBLOB|  
|bigint(255) unsigned|默认bigint(22)|
|TEXT|  
|65535*3越界，不支持|默认bigint(22)|
|LONGTEXT|  
|不支持|默认bigint(22)|
|TINYTEXT|  
|bigint(765) unsigned|默认bigint(22)|


当前bigint的显示宽度影响：

1、zerofill属性下的查询（  下来调研一下  ）

2、mysql黑屏工具：只影响–quick参数的打印格式

### 二、LAST_INSERT_ID返回的值

LAST_INSERT_ID返回的值是会话级别的，会话间隔离，分别计算

1、rollback不会影响last_insert_id返回的值

```
drop table if exists t_last;
create table t_last(col1 int primary key auto_increment, col2 bigint);
insert into t_last (col2) values (1);
select last_insert_id();
insert into t_last (col2) values (1);
select last_insert_id();
rollback;
select last_insert_id();
```

![](https://pingcode.yasdb.com/atlas/files/public/673968658970c2af4f51f223/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUtBQUFBSUFBQUFBQUlBQUFBQUFRQUFBQUFBQUFCQUFBQUVBQUVBQUlBQkFJSUFBQUFBQWdBQUFDQUFBQmdJQUFBQUJJQUFCQUFDQUFBQUVBQUFBQUFBQUFDQkFBQUFBSUFBQUFBZ0FBQUFBQUFDQUFnQUFBZ0FBQWdBQUFBQUFFQUFBQUFBSWdBSUFBQkFBSUlBQUtBUUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTUwNDIsImV4cCI6MTc4MjQ2NTg0Mn0.n3Nus3s_G1aWEeCxAdmLe_qRVhlpj9PvtZIvnfqAJIs)

2、不受当前stmt影响

如果当前执行的stmt中引用了last_insert_id()，那么last_insert_id()不受当前stmt内更新的值影响

```
drop table if exists t_last;
create table t_last(col1 int primary key auto_increment, col2 bigint);
insert into t_last (col2) values (1);
select last_insert_id();
insert into t_last (col2) values (last_insert_id()),(last_insert_id()),(last_insert_id());
select * from t_last;
select last_insert_id();
```

![](https://pingcode.yasdb.com/atlas/files/public/67396865a1ad9a3311dc7099/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUtBQUFBSUFBQUFBQUlBQUFBQUFRQUFBQUFBQUFCQUFBQUVBQUVBQUlBQkFJSUFBQUFBQWdBQUFDQUFBQmdJQUFBQUJJQUFCQUFDQUFBQUVBQUFBQUFBQUFDQkFBQUFBSUFBQUFBZ0FBQUFBQUFDQUFnQUFBZ0FBQWdBQUFBQUFFQUFBQUFBSWdBSUFBQkFBSUlBQUtBUUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTUwNDIsImV4cCI6MTc4MjQ2NTg0Mn0.n3Nus3s_G1aWEeCxAdmLe_qRVhlpj9PvtZIvnfqAJIs)

3、last_insert_id()在一次插入多行的场景下，只返回第一行修改的结果，这样做的原因是，可以轻松地对其他服务器复制相同的INSERT语句

场景1：insert into xxx values (),(),()：已验证

场景2：  insert into select：已验证

场景3：绑定参数插入(for example：mysql jdbc +   useServerPrepStmts=true  )：返回的是最后一行的结果

4、插入NULL/0时，实际插入值都为1，last_insert_id()也为1

```
drop table if exists t_last;
create table t_last(col1 int primary key auto_increment, col2 bigint);
insert into t_last values (null, 1);
select last_insert_id();
select * from t_last;

drop table if exists t_last;
create table t_last(col1 int primary key auto_increment, col2 bigint);
insert into t_last values (0, 1);
select last_insert_id();
select * from t_last;
```

![](https://pingcode.yasdb.com/atlas/files/public/67396865a1ad9a3311dc709a/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUtBQUFBSUFBQUFBQUlBQUFBQUFRQUFBQUFBQUFCQUFBQUVBQUVBQUlBQkFJSUFBQUFBQWdBQUFDQUFBQmdJQUFBQUJJQUFCQUFDQUFBQUVBQUFBQUFBQUFDQkFBQUFBSUFBQUFBZ0FBQUFBQUFDQUFnQUFBZ0FBQWdBQUFBQUFFQUFBQUFBSWdBSUFBQkFBSUlBQUtBUUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTUwNDIsImV4cCI6MTc4MjQ2NTg0Mn0.n3Nus3s_G1aWEeCxAdmLe_qRVhlpj9PvtZIvnfqAJIs)

5、SQL_MODE：no_auto_value_on_zero

```
SET sql_mode = CONCAT(@@sql_mode, ',NO_AUTO_VALUE_ON_ZERO');
drop table if exists t_last;
create table t_last(col1 int primary key auto_increment, col2 bigint);
insert into t_last values (0, 1);
insert into t_last values (0, 1);
select last_insert_id();
select * from t_last;
```

这个参数设置后，对auto_increment列插入0值将不会变成自增列，而是还保持0

![](https://pingcode.yasdb.com/atlas/files/public/67396865a1ad9a3311dc709b/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUtBQUFBSUFBQUFBQUlBQUFBQUFRQUFBQUFBQUFCQUFBQUVBQUVBQUlBQkFJSUFBQUFBQWdBQUFDQUFBQmdJQUFBQUJJQUFCQUFDQUFBQUVBQUFBQUFBQUFDQkFBQUFBSUFBQUFBZ0FBQUFBQUFDQUFnQUFBZ0FBQWdBQUFBQUFFQUFBQUFBSWdBSUFBQkFBSUlBQUtBUUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTUwNDIsImV4cCI6MTc4MjQ2NTg0Mn0.n3Nus3s_G1aWEeCxAdmLe_qRVhlpj9PvtZIvnfqAJIs)

6、列创建后被修改为auto_increment，last_insert_id()不会立即更新，只会在下一次插入后更新

```
drop table if exists t_last;
create table t_last(col1 int primary key auto_increment, col2 bigint);
insert into t_last (col2) values (1);
alter table t_last  AUTO_INCREMENT = 100;
select last_insert_id();
insert into t_last (col2) values (1);
select last_insert_id();
```

![](https://pingcode.yasdb.com/atlas/files/public/673968658970c2af4f51f224/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUtBQUFBSUFBQUFBQUlBQUFBQUFRQUFBQUFBQUFCQUFBQUVBQUVBQUlBQkFJSUFBQUFBQWdBQUFDQUFBQmdJQUFBQUJJQUFCQUFDQUFBQUVBQUFBQUFBQUFDQkFBQUFBSUFBQUFBZ0FBQUFBQUFDQUFnQUFBZ0FBQWdBQUFBQUFFQUFBQUFBSWdBSUFBQkFBSUlBQUtBUUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTUwNDIsImV4cCI6MTc4MjQ2NTg0Mn0.n3Nus3s_G1aWEeCxAdmLe_qRVhlpj9PvtZIvnfqAJIs)

7、  显式赋值不会使last_insert_id返回值得到更新，当显式赋值后第一次隐式更新auto_increment，  last_insert_id返回值将变成其原有最大值+1

```
drop table if exists t_last;
create table t_last(col1 int primary key auto_increment, col2 bigint);
insert into t_last values (1, 1);
insert into t_last values (6, 1);
select last_insert_id();
select * from t_last;
insert into t_last values (2, 1);
select last_insert_id();
select * from t_last;
insert into t_last (col2) values (1);
select last_insert_id();
select * from t_last;
```

![](https://pingcode.yasdb.com/atlas/files/public/67396866a1ad9a3311dc709c/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUtBQUFBSUFBQUFBQUlBQUFBQUFRQUFBQUFBQUFCQUFBQUVBQUVBQUlBQkFJSUFBQUFBQWdBQUFDQUFBQmdJQUFBQUJJQUFCQUFDQUFBQUVBQUFBQUFBQUFDQkFBQUFBSUFBQUFBZ0FBQUFBQUFDQUFnQUFBZ0FBQWdBQUFBQUFFQUFBQUFBSWdBSUFBQkFBSUlBQUtBUUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTUwNDIsImV4cCI6MTc4MjQ2NTg0Mn0.n3Nus3s_G1aWEeCxAdmLe_qRVhlpj9PvtZIvnfqAJIs)

8、存储过程相关：

如果存储过程中有insert修改了last_insert_id，那么同一存储过程中，此insert结束后，last_insert_id变更

```
drop table if exists t_last;
create table t_last(col1 int primary key auto_increment, col2 bigint);
insert into t_last (col2) values (1);
select last_insert_id();

drop PROCEDURE insert_and_query;
DELIMITER //
CREATE PROCEDURE insert_and_query()
BEGIN
    insert into t_last (col2) values (1);
    select last_insert_id();
END //
DELIMITER ;

CALL insert_and_query();
select last_insert_id();
```

9、触发器相关：

触发器内部的insert不会更新last_insert_id();的值

```
drop table if exists t_last;
create table t_last(col1 int primary key auto_increment, col2 bigint);
insert into t_last (col2) values (1);
select last_insert_id();

drop table if exists t_last2;
create table t_last2(col1 int primary key auto_increment, col2 bigint);
insert into t_last2 (col2) values (1);
insert into t_last2 (col2) values (1);
select last_insert_id();

DELIMITER //
CREATE TRIGGER insert_trigger1
AFTER INSERT ON t_last
FOR EACH ROW
BEGIN
    insert into t_last2 (col2) values (1);
END //
DELIMITER ;
insert into t_last (col2) values (1);

select last_insert_id();
select * from t_last;
select * from t_last2;
```

11、1入参场景下，存last_insert_id值后插入，last_insert_id值会被更新

```
drop table if exists t_last;
create table t_last(col1 int primary key auto_increment, col2 bigint);
insert into t_last (col2) values (1);
select last_insert_id();
select last_insert_id(100);
insert into t_last (col2) values (1);
select last_insert_id();
```

![](https://pingcode.yasdb.com/atlas/files/public/67396866a1ad9a3311dc709d/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUtBQUFBSUFBQUFBQUlBQUFBQUFRQUFBQUFBQUFCQUFBQUVBQUVBQUlBQkFJSUFBQUFBQWdBQUFDQUFBQmdJQUFBQUJJQUFCQUFDQUFBQUVBQUFBQUFBQUFDQkFBQUFBSUFBQUFBZ0FBQUFBQUFDQUFnQUFBZ0FBQWdBQUFBQUFFQUFBQUFBSWdBSUFBQkFBSUlBQUtBUUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTUwNDIsImV4cCI6MTc4MjQ2NTg0Mn0.n3Nus3s_G1aWEeCxAdmLe_qRVhlpj9PvtZIvnfqAJIs)

12、无法理解的项：

对于非事务表，AUTO_INCREMENT计数器不会递增。

```
CREATE TABLE myisam_table (
    id INT PRIMARY KEY,
    name VARCHAR(50),
    age INT
) ENGINE = MyISAM
在上述示例中，通过 CREATE TABLE 语句创建了一个名为 myisam_table 的表，包含 id、name 和 age 三个列，并指定存储引擎为 MyISAM，这样就创建了一个非事务表。MyISAM 表的特点是不支持事务，但在一些场景下具有较高的读写性能，适合对数据一致性要求不高，但对性能要求较高的应用。

CREATE TABLE memory_table (
    id INT PRIMARY KEY,
    name VARCHAR(50),
    age INT
) ENGINE = MEMORY;
这里创建了一个名为 memory_table 的表，同样包含 id、name 和 age 三个列，存储引擎指定为 MEMORY。MEMORY 存储引擎将表数据存储在内存中，读写速度非常快，但数据在服务器重启后会丢失，适合用于临时数据存储或对性能要求极高的缓存类应用等非事务场景。
```

  


13、insert into select会修改last_insert_id

```
drop table if exists t_last;
create table t_last(col1 int primary key auto_increment, col2 bigint);
select last_insert_id();
insert into t_last (col2) select 1 from dual;
select last_insert_id();
```

14、create table as select

这种场景不具备插入auto_increment默认值的语法

```
drop table if exists t_last;
create table t_last(col1 int primary key auto_increment, col2 bigint) as select 1,2 from dual;
select last_insert_id();
insert into t_last (col2) select 1 from dual;
select last_insert_id();
```

15、当插入失败时，last_insert_id不更新，但是auto_increment已经自增

```
drop table if exists t_last;
create table t_last(col1 int primary key auto_increment, col2 bigint unique);
insert into t_last (col2) values (1);
select last_insert_id();
insert into t_last (col2) values (1);
select last_insert_id();
insert into t_last (col2) values (2);
select last_insert_id();
```

![](https://pingcode.yasdb.com/atlas/files/public/67396866a1ad9a3311dc709e/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUtBQUFBSUFBQUFBQUlBQUFBQUFRQUFBQUFBQUFCQUFBQUVBQUVBQUlBQkFJSUFBQUFBQWdBQUFDQUFBQmdJQUFBQUJJQUFCQUFDQUFBQUVBQUFBQUFBQUFDQkFBQUFBSUFBQUFBZ0FBQUFBQUFDQUFnQUFBZ0FBQWdBQUFBQUFFQUFBQUFBSWdBSUFBQkFBSUlBQUtBUUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTUwNDIsImV4cCI6MTc4MjQ2NTg0Mn0.n3Nus3s_G1aWEeCxAdmLe_qRVhlpj9PvtZIvnfqAJIs)

## Attachments:

[image2024-11-5_18-21-57.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY4NjRhMWFkOWEzMzExZGM3MDk1IiwicmVmX2lkIjoiNjczOTY4NjQ3MjgyMDZlZmI5MmVlZDJhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU1MDQyLCJleHAiOjE3ODI1NDE0NDJ9.Kjr_rxR_2edwrmRA37rxOBVoLfyAFWSd0ELeNWx3ssU)

 (image/png)    


[image2024-11-7_16-26-17.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY4NjU4OTcwYzJhZjRmNTFmMjIyIiwicmVmX2lkIjoiNjczOTY4NjQ3MjgyMDZlZmI5MmVlZDJhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU1MDQyLCJleHAiOjE3ODI1NDE0NDJ9.9ljIDudnNFewFcKNHIxbTPJTru-fuvLxguTr1EseXxU)

 (image/png)    
