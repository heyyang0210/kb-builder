Created by 赵忠源, last modified on 四月 15, 2024

* IR链接：*    [YDBRD-11390](https://jira.yasdb.com/browse/YDBRD-11390?src=confmacro)    *-*  *投影列支持表达式as设置别名为空*  *待RMT评审*

##   [1. 总述](#1-总述)  

投影列支持表达式as设置别名为空

###   [1.1 需求来源](#11-需求来源)  

POC需求    
  需求范围：    
  1、单机

###   [1.2 调研文档](#12-调研文档)  

调研文档：    [https://conf.yasdb.com/pages/viewpage.action?pageId=147778911](https://conf.yasdb.com/pages/viewpage.action?pageId=147778911)  

###   [1.3 需求分析](#13-需求分析)  

表达式设置别名为空时，表现为简单列设置回原投影列空别名不会用作该投影列的别名

经调研，Oracle列别名多个使用场景下都无对空格列别名" "的解析。

##   [2. 接口](#2-接口)  

添加lexTryReadAlias接口，用于对AS关键词后的别名alias做解析

##   [3. 规格与约束](#3-规格与约束)  

同原列别名规格与约束，仅对AS后跟空格/空别名放开拦截

NULL及''情况都将报错

##   [4. 特性](#4-特性)  

###   [4.1 特性设计](#41-特性设计)  

原解析别名流程中，解析到AS关键词后会往后fetch别名，对于空格情况都会默认trim掉并移动lexer。

现在在解析别名流程中增加tryfetch流程，当fetch不到别名时（fetch到',' from等场景），默认为原投影列，其他非法场景报错。

对于部分函数（允许无入参的函数），别名为空时会设置为原函数名

若列类型为位列，则不允许别名设置为空

##   [5. Testcases（自测用例）](#5-testcases自测用例)  

```
create table alias_tb(c1 int, a int, b int);
insert into alias_tb values('1', '2', '3');
commit;

select c1 + from alias_tb;
select c1 + b from alias_tb;
select c1 +, b from alias_tb;
select c1 '+', b from alias_tb;
select c1 "+", b from alias_tb;
select c1 '+' from alias_tb;
select c1 "+" from alias_tb;


-- with as
select c1 as  from alias_tb;
select c1 as '' from alias_tb;
select c1 as NULL from alias_tb;
select c1 as "" from alias_tb;
select c1 as + from alias_tb;
select c1 as '+' from alias_tb;
select c1 as "+" from alias_tb;

select c1 as + b from alias_tb;
select c1 as '+' b from alias_tb;
select c1 as "+" b from alias_tb;
select c1 as "+",b from alias_tb;


select c1 as , from alias_tb;
select c1 as ',' from alias_tb;
select c1 as "," from alias_tb;


```

##   [6.资料设计章节](#6资料设计章节)  

资料在设计阶段，要识别出来相关需要调整的范围、大纲。

##   [7.未来规划](#7未来规划)  

说明本方案遗留待解决的问题、下一步需要解决的问题或者未来演进规划。

## Comments:

|  [](null)  ,会议纪要：    
  1.设置为空别名时，可通过expr+AS 查询到，,规格差异：DDL 创建视图时语法允许，正常设置别名时设置为expr+AS,如：select t1."A+BAS" from (select a+b as from alias_tb) t1;,create or replace view ooo1 as select 1+2 FROM dual;,2.需求范围【待确定】外拦截,  
,Posted by zhaozhongyuan at 四月 10, 2024 12:07|
|---|
