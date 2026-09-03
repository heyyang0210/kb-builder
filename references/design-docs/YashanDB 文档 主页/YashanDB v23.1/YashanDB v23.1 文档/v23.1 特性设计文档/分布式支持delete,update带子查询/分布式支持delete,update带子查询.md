Created by 林俊喆, last modified by  许中立 on 一月 30, 2024

##   [1. Overview（概述）](#1-overview概述)  

需求：分布式下支持带子查询的delete和update

##   [2. Features（功能特性）](#2-features功能特性)  

##   [3. Interfaces（接口）](#3-interfaces接口)  

没有变更delete和update的语法，语法可以参考文档：

  [https://cod-doc.yasdb.com/yashandb/alpha/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/SQL%E8%AF%AD%E5%8F%A5/DELETE.html](https://cod-doc.yasdb.com/yashandb/alpha/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/SQL%E8%AF%AD%E5%8F%A5/DELETE.html)  

  [https://cod-doc.yasdb.com/yashandb/alpha/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/SQL%E8%AF%AD%E5%8F%A5/UPDATE.html](https://cod-doc.yasdb.com/yashandb/alpha/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/SQL%E8%AF%AD%E5%8F%A5/UPDATE.html)  

##   [4. Specification And Constraints（规格与约束）](#4-specification-and-constraints规格与约束)  

不支持关联子查询，带关联子查询报错。

不支持多表delete、update。

##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

###   [方案一](#方案一)  

子查询走列执行器；子查询的结果物化；update、delete走行执行器，在执行到filter的时候使用子查询的结果过滤。

1. rewrite阶段需要判断根据是否是分布式执行delete或update，禁用in/exist/any/all改写为join。delete和update所在的那一层sql都在行存执行，分布式行存join没有验证过，所以分布式下delete和update先禁用in/exist/any/all改写为join。
1. 每个子查询根据是分布式下的update或delete，在select下增加col2row算子。
1. 修改分布式下标量子查询的执行，标量子查询和其他非关联子查询一样，也走物化。


###   [方案二](#方案二)  

update、delete走列执行器，需要新增update、delete的crab算子，预估工作量2人月，无法在23.1版本完成。

##   [6. Testcases（自测用例）](#6-testcases自测用例)  

```
删除表分布表 子查询分布表
create table t1 (c1 int, c2 varchar(20)) organization tac;
insert into t1 values (1, '1'), (2,'2');

create table t2 (c1 int, c2 varchar(20)) organization tac;
insert into t2 values(1, '1');

create table t3 (c1 int, c2 varchar(20)) organization tac;
insert into t3 values(2, '2');
insert into t3 values(null, 'null');

create table t4 (c1 boolean, c2 int) organization tac;
insert into t4 values (false, 1);
insert into t4 values (true, 2);
commit;

删除表分布表 子查询复制表
create table t1 (c1 int, c2 varchar(20)) organization tac;
insert into t1 values (1, '1'), (2,'2');

create duplicated table t2 (c1 int, c2 varchar(20)) organization tac;
insert into t2 values(1, '1');

create duplicated table t3 (c1 int, c2 varchar(20)) organization tac;
insert into t3 values(2, '2');
insert into t3 values(null, 'null');

create duplicated table t4 (c1 boolean, c2 int) organization tac;
insert into t4 values (false, 1);
insert into t4 values (true, 2);
commit;

删除表分布表 子查询复制表加分布表
create table t1 (c1 int, c2 varchar(20)) organization tac;
insert into t1 values (1, '1'), (2,'2');

create duplicated table t2 (c1 int, c2 varchar(20)) organization tac;
insert into t2 values(1, '1');

create duplicated table t3 (c1 int, c2 varchar(20)) organization tac;
insert into t3 values(2, '2');
insert into t3 values(null, 'null');

create table t4 (c1 boolean, c2 int) organization tac;
insert into t4 values (false, 1);
insert into t4 values (true, 2);
commit;

删除表复制表 子查询分布表
create duplicated table t1 (c1 int, c2 varchar(20)) organization tac;
insert into t1 values (1, '1'), (2,'2');

create table t2 (c1 int, c2 varchar(20)) organization tac;
insert into t2 values(1, '1');

create table t3 (c1 int, c2 varchar(20)) organization tac;
insert into t3 values(2, '2');
insert into t3 values(null, 'null');

create table t4 (c1 boolean, c2 int) organization tac;
insert into t4 values (false, 1);
insert into t4 values (true, 2);
commit;

delete from t1 where t1.c1 in (select c1 from t2);
delete from t1 where t1.c1 = (select c1 from t2);
delete from t1 where t1.c1 in (select c1 from t2 union select c1 from t3);
delete from t1 where t1.c1 in (select c1 from t2 where t2.c1 &lt; any (select c1 from t3));
delete from t1 where t1.c1 in (select c1 from t2 where t2.c1 &lt; all (select c1 from t3));
delete from t1 where t1.c1 in (select c1 from t2 where t2.c1 &lt; all (select distinct c1 from t3));
delete from t1 where t1.c1 in (select c1 from t2 where t2.c1 &lt; all (select distinct t3.c1 from t3 join t4 on t3.c1 = t4.c2));
delete from t1 where exists (select c1 from t2);
delete from t1 where t1.c1 in (select c1 from t2 where exists (select c1 from t3));
delete from t1 where not exists (select c1 from t2);

update t1 set t1.c2 = '3' where t1.c1 in (select c1 from t2);
update t1 set t1.c2 = '3' where t1.c1 = (select c1 from t2);
update t1 set t1.c2 = '3' where t1.c1 in (select c1 from t2 union select c1 from t3);
update t1 set t1.c2 = '3' where t1.c1 in (select c1 from t2 where t2.c1 &lt; any (select c1 from t3));
update t1 set t1.c2 = '3' where t1.c1 in (select c1 from t2 where t2.c1 &lt; all (select c1 from t3));
update t1 set t1.c2 = '3' where t1.c1 in (select c1 from t2 where t2.c1 &lt; all (select distinct c1 from t3));
update t1 set t1.c2 = '3' where t1.c1 in (select c1 from t2 where t2.c1 &lt; all (select distinct t3.c1 from t3 join t4 on t3.c1 = t4.c2));
update t1 set t1.c2 = '3' where exists (select c1 from t2);
update t1 set t1.c2 = '3' where t1.c1 in (select c1 from t2 where exists (select c1 from t3));
update t1 set t1.c2 = '3' where not exists (select c1 from t2);


```

## Comments:

|  [](null)  ,增加用例：,子查询带系统表、临时表、dual，各种表类型,子查询位置,Posted by linjunzhe at 八月 01, 2023 16:33|
|---|
|  [](null)  ,数据类型不匹配，绑定参数（用匿名块测）,Posted by linjunzhe at 八月 01, 2023 16:35|
|  [](null)  ,系统表、临时表、dual、tac、lsc、表函数,Posted by linjunzhe at 八月 01, 2023 16:45|
