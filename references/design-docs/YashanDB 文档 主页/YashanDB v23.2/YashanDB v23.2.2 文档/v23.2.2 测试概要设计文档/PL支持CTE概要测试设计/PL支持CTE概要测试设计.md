Created by 李思语, last modified on 三月 25, 2024

##   [1. 需求概述](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#1-%E9%9C%80%E6%B1%82%E6%A6%82%E8%BF%B0)  

*需求与场景概述*

SELECT 已支持 CTE（Common Table Expressions，公共表表达式），  在PL静态SQL特性中，支持直接给定CTE语法形式，  进一步完善 PL语言特性。

部署形态：单机、集群。

##   [2. 功能点](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#2-%E5%8A%9F%E8%83%BD%E7%82%B9)  

- 过程体和匿名块支持CTE语法功能


##   [3. 规格约束](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#3-%E8%A7%84%E6%A0%BC%E7%BA%A6%E6%9D%9F)  

参考CTE约束：

- 不支持递归CTE


##   [4. 主要应用场景](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#4-%E4%B8%BB%E8%A6%81%E5%BA%94%E7%94%A8%E5%9C%BA%E6%99%AF)  

- 在PL语言中可使用子查询的位置均可应用CTE语法


##   [5. 概要测试设计](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#5-%E6%A6%82%E8%A6%81%E6%B5%8B%E8%AF%95%E8%AE%BE%E8%AE%A1)  

### 1.在plsql复用cte用例执行

|输入条件|使用场景|备注|
|---|---|---|
|INSERT|insert into t1 with cte|  
|
||insert into cte select|暂不支持|
|UPDATE|update cte|暂不支持|
|  
|update set column，column是cte|  
|
|  
|update set column = cte|  
|
|  
|set (column, column) = cte|Oracle不支持|
|  
|update where cte|  
|
|DELETE|delete from cte|暂不支持|
|  
|delete from where cte|  
|
|CREATE TABLE|create table as cte|create table as (with）,create table as with|
|CREATE VIEW|create view as cte|  
|
|  
|create force view as cte|  
|
|CREATE MATERIALIZED VIEW|create materialized view as cte|  
|
|WHERE|select from where cte|  
|
|  
|select from where exists cte|  
|
|  
|select from where column in cte|  
|
|  
|select from where column cmp  cte|>,=,<,<=, >=,any, all|
|HAVING|select from having cte|  
|
|  
|select from having exists cte|  
|
|  
|select from having column in cte|  
|
|  
|select from having column cmp  cte|  
|
|START WITH|select from start with cte|  
|
|  
|select from start with exists cte|  
|
|  
|select from start with column in cte|  
|
|  
|select from start with column cmp  cte|  
|
|SELECT|select cte from |  
|
|FROM|select from cte|  
|
|MERGE|  
|  
|


### 2.plsql使用场景：

|plsql对象|
|---|
|匿名块|
|自定义函数|
|自定义存储过程|
|自定义高级包|


  


|游标|语法|
|---|---|
|隐式游标|```
with cte select into[标量,record,udt]

```|
|静态游标(显式游标):|```
cursor&nbsp;cursor_name is with cte select＿statement;
cursor&nbsp;cursor_name is&nbsp;with cte select＿statement return xx%rowtype;
cursor&nbsp;cursor_name(args) is with cte select＿statement;
cursor&nbsp;cursor_name(args) is with cte select＿statement return xx%rowtype;

```|
|动态游标:|```
declare
...
type cur1 is ref cursor; 
type cur2 is ref cursor return xx%rowtype; 
cur_test1 cur1;
cur_test2 cur2;
...
begin
open cur_test1 for with cte select_statment1;
...
open cur_test2 for with cte select_statment2;
...
end;

```|
|系统游标|```
declare
...
cur_test sys_refcursor;
...
begin
open cur_test for with cte select_statment1;
...
open cur_test for with cte select_statment2;
...
end;

```|
|for循环游标|```
隐式游标
for index in 'with cte select_statment'; 

显示游标
declare
cursor cur is with cte select_statment;
begin
for index in cur; 
...
end;

```|
|Bulk游标|```
declare
type cur is table of xx%rowtype;
var cur 
begin
...
with cte select * bulk collect into var from ...
...
end;

declare
type udt_01 is table of xx%rowtype;
CURSOR cur_01 is with cte as select ...
var_01 udt_01 ;
begin
...
fetch cur_01 bulk collect into var_01;
for i in var_01.first .. var_01.last loop 
...
end loop;
...
end;

```|


### 3.动态执行静态sql

```
execute immediate 'with cte as (select...) select :1 from cte' using a;

```

  [5.2 DFX测试设计](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#52-dfx%E6%B5%8B%E8%AF%95%E8%AE%BE%E8%AE%A1)  

- CT,KT


##   [6. 测试策略](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#6-%E6%B5%8B%E8%AF%95%E7%AD%96%E7%95%A5)  

*测试覆盖策略、自动化看护策略*

*测试框架满足度，如果需要使用新的测试框架，或有新的测试框架需求需要提给测开组或对应TSE*

##   [7. 后续关注(可选)](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#7-%E5%90%8E%E7%BB%AD%E5%85%B3%E6%B3%A8%E5%8F%AF%E9%80%89)  

*依赖特性识别*

*后续测试详细设计中需要关注的内容*

关注udt,recode,pkg.recode,pkg.udt 类型变量

  
