Created by 郑荃, last modified on 十一月 11, 2024

SR:

  [https://pingcode.yasdb.com/pjm/items/6618f12cfd997db58ad84c7d](https://pingcode.yasdb.com/pjm/items/6618f12cfd997db58ad84c7d)  ?  
#YDBRD-26193 【CCB转需求】重复更新检测优化-多表update/delete

  [https://pingcode.yasdb.com/pjm/items/6715cf22e489dd0868faafc6?](https://pingcode.yasdb.com/pjm/items/6715cf22e489dd0868faafc6?)  

#YDBRD-34498 【CCB转需求】重复更新检测优化-Merge Into、外键级联处理

# 1. 概述

1. 优化现有并发更新方案，提升并发更新性能；
1. 解决现有重复更新的局限性，使得内核具备重复更新检测能力而不依赖上层。


# 2. 需求分析

## 2.1 功能点分析

- set列和filter条件列的值发生变更时，会重启，不依赖写一致性开关（  如果filter条件不是更新的表，条件变化不会触发语句重启，filter条件变更的表是更新的表会触发语句重启  ）
- 多表更新场景下，同一行只会被更新一次，  对于0→0→1这类更新可以做到容忍更新 ，如果是0-1-0 则报错


## 2.2 应用场景

   需求本身的主要应用场景

- 多表dml场景
- merge into 


## 2.3 规格约束

- 单表无法改写成多表join
- view filter无法下推到kernel table


# 3. 详细测试设计

## 3.1 测试设计方法

主要采用场景法，构造会触发重复更新检测和语句重启场景

覆盖范围：

是否发生语句重启，可以通过v$sqlArea 来观测

select SQL_TEXT,RESTART_STATEMENTS from v$sqlArea where RESTART_STATEMENTS>0;

|部署形态|单机/集群|
|:---|:---|
|表类型|heap/tac|
|  
|普通表/分区表/临时表/嵌套表/视图/子查询|
|其它对象交互|索引：desc 、asc索引（结果顺序可能不一样）|
|  
|触发器（after、before）|
|数据类型|lob（locator  ）、udt（嵌套表，varry、object）、数值，字符|
|隔离级别|读已提交、可串行化|
|写一致性|关闭语句重启、开启语句重启|
|DML|多表update、多表delete、merge into|
|事务管理操作|commit、  rollback 、  savepoint |
|事务类型|普通事务、自治事务、XA事务（本次需求应该不涉及）|


## 3.2 详细测试设计

### 1、语句重启

- 同一个场景，根据实际情况覆盖不同隔离级别、表类型、语句重启、不同事务操作（  commit、rollback、savepoint）
- filter条件对于多表dml 是where条件， 对于merge into，可以是on condition，也可以是dml后面跟的filter
- 多表join方式：INNER JOIN 、CROSS JOIN、LEFT JOIN、RIGTH JOIN、FULL JOIN、HASH JOIN SEMI


  


|  
|分类|场景覆盖说明|参考|备注|
|---|---|---|---|---|
|1|要修改的范围发生变更,- filter条件被改变
|1、where条件被其他session从满足条件被其他session修改成不满足|create table test_multi_table_update_reinforce_001_1(f1 int,f2 int,f3 clob,f4 int) lob (f3) STORE AS (DISABLE STORAGE IN ROW);    
  create table test_multi_table_update_reinforce_001_2(f1 int,f2 int,f3 clob ,f4 int) lob (f3) STORE AS (DISABLE STORAGE IN ROW);    
  insert into test_multi_table_update_reinforce_001_1 values(1,100,'test1',1000);    
  insert into test_multi_table_update_reinforce_001_1 values(2,100,'test1',1000);    
  insert into test_multi_table_update_reinforce_001_1 values(3,100,'test1',1000);    
  insert into test_multi_table_update_reinforce_001_1 values(4,100,'test1',1000);    
  insert into test_multi_table_update_reinforce_001_1 values(5,100,'test1',1000);    
  insert into test_multi_table_update_reinforce_001_1 values(6,200,'test1',1000);    
  commit;    
  insert into test_multi_table_update_reinforce_001_2 values(1,500,'test1',3000);    
  insert into test_multi_table_update_reinforce_001_2 values(2,500,'test1',3000);    
  insert into test_multi_table_update_reinforce_001_2 values(3,500,'test1',3000);    
  insert into test_multi_table_update_reinforce_001_2 values(4,500,'test1',3000);    
  insert into test_multi_table_update_reinforce_001_2 values(5,500,'test1',3000);    
  insert into test_multi_table_update_reinforce_001_2 values(6,600,'test1',3000);    
  --session1    
  update test_multi_table_update_reinforce_001_1 set f2=150 where f1=4;    
  update test_multi_table_update_reinforce_001_1 set f2=150 where f1=5;    
  --session2    
  update test_multi_table_update_reinforce_001_1 t1,test_multi_table_update_reinforce_001_2 t2 set t1.f4=t2.f4 where t1.f2<150;    
  --session1    
  commit;    
  select * from test_multi_table_update_reinforce_001_1;    
  --session2 （f2=4\5被修改成f2=150,不满足条件，如果session1 commit则不更新，session1 rollback可以更新）    
  commit;    
  select * from test_multi_table_update_reinforce_001_1;    
  drop table if exists test_multi_table_update_reinforce_001_1;    
  drop table if exists test_multi_table_update_reinforce_001_2;|修改的方式（根据需求选择性覆盖）：,- update方式把数据从满足条件修改成不满足
- delete删除掉满足条件的数据
- delete+insert：删除满足的数据再插入不满足条件的数据，在一个事务
|
|2||2、where条件被其他session修改成不满足到满足|--session1    
  update test_multi_table_update_reinforce_001_1 set f2=150 where f1=4;    
  update test_multi_table_update_reinforce_001_1 set f2=150 where f1=5;    
  --session2    
  update test_multi_table_update_reinforce_001_1 t1,test_multi_table_update_reinforce_001_2 t2 set t1.f4=t2.f4 where t1.f2>=150;    
  --session1    
  commit;    
  select * from test_multi_table_update_reinforce_001_1;    
  --session2     
  commit;    
  select * from test_multi_table_update_reinforce_001_1;|修改的方式：,- update方式把数据从不满足条件修改成满足
- insert满足条件的数据
- delete+insert：删除不满足的数据再插入满足条件的数据，在一个事务
- insert+update：插入数据，然后再update成满足条件的数据
|
|3||3、where条件被其他session从满足条件被其他session修改成满足到满足|--session1    
  update test_multi_table_update_reinforce_001_1 set f2=120 where f1=4;    
  update test_multi_table_update_reinforce_001_1 set f2=120 where f1=5;    
  --session2    
  update test_multi_table_update_reinforce_001_1 t1,test_multi_table_update_reinforce_001_2 t2 set t1.f4=t2.f4 where t1.f2<150;    
  --session1    
  commit;    
  select * from test_multi_table_update_reinforce_001_1;    
  --session2     
  commit;    
  select * from test_multi_table_update_reinforce_001_1;|修改的方式：,- update方式把数据从满足条件修改成满足
- delete+insert：删除满足的数据再插入满足的数据，在一个事务
|
|4||4、where条件被其他session 修改，数据的修改同时存在以上3种场景的混合|  
|- filter条件数据被修改是一个事务
- filter条件修改是多个事务
|
|5||5、其他session修改的表为当前session修改的表|  
|  
|
|6||6、其他session修改的表在where条件，但是不是修改的表（update t1  set f1=f1+1 where  f1 in (select f1 from t2)，修改的数据为t2的)|  
|  
|
|7|要修改的范围发生变更,- 不带filter条件
|1、在等待过程中，有新增数据,2、在等待过程中，有数据被删除,3、在等待的过程中，数据更新|--session1    
  delete from test_multi_table_update_reinforce_001_1  where f1=4;    
  --session2    
  update test_multi_table_update_reinforce_001_1 t1,test_multi_table_update_reinforce_001_2 t2 set t1.f4=t2.f4;    
  --session1    
  commit;    
  select * from test_multi_table_update_reinforce_001_1;    
  --session2    
  commit;    
  select * from test_multi_table_update_reinforce_001_1;|  
|
|8|SET 要改的列被被改变|不同session修改同一行数据的同一列|--session1    
  update test_multi_table_update_reinforce_001_1 set f4=f4+100 where f1=4;    
  --session2    
  update test_multi_table_update_reinforce_001_1 t1,test_multi_table_update_reinforce_001_2 t2 set t1.f4=t2.f4 where t1.f2<150;    
  --session1    
  commit;    
  select * from test_multi_table_update_reinforce_001_1;    
  --session2    
  commit;    
  select * from test_multi_table_update_reinforce_001_1;|  
|
|9|SET 要改的列和filter条件同时发生改变|  
|--session1    
  update test_multi_table_update_reinforce_001_1 set f2=110 where f1=4;    
  update test_multi_table_update_reinforce_001_2 set f2=120 where f1=4;    
  --session2    
  update test_multi_table_update_reinforce_001_1 t1,test_multi_table_update_reinforce_001_2 t2 set t1.f4=t2.f4,t1.f2=t2.f2 where t1.f2<150;    
  --session1    
  commit;    
  select * from test_multi_table_update_reinforce_001_1;    
  --session2    
  commit;    
  select * from test_multi_table_update_reinforce_001_1;|  
|
|10|要修改的数据或者filter条件，并发过程中数据位置变化|1、跨分区更新,- 在等待的过程中数据的位置由于其他session修改，发生了跨分区更新，去了别的分区
,2、shrink table ,- 在等待的过程中数据的位置由于其他session进行shrink table，数据的位置发生了搬移
|  
|  
|
|11|规格|单表无法改写成多表join，不会触发语句重启|  
|  
|
|  
|  
|view filter无法下推到kernel table，不会触发语句重启|  
|  
|


### 2、重复更新

|分类|场景|用例参考|预期|说明|
|---|---|---|---|---|
|多表update/delete|同一行，匹配了多行，会被更新多次，但是多次的值是一样的2-1-1-1-1|create table T1(f1 int ,f2 int);,insert into T1 values(1, 2);,create table T2(f1 int ,f2 int);,insert into T2values(1, 1);,insert into T2values(1, 1);,insert into T2values(1, 1);    
    
|更新成功，即使顺序变更，也不会报错|  
|
|  
|同一行，匹配了多行，会被更新多次，但是多次的0-1-2-3,1、通过插入顺序变更 构造更新顺序变更,2、通过hint方式构造顺序变更|create table T1(f1 int ,f2 int);,insert into T1values(1, 0);,create table T2(f1 int ,f2 int);,insert into T2values(1, 1);,insert into T2values(1, 2);,insert into T2values(1, 3);|结果可能不稳定，但是不会报错|  
|
|  
|同一行，匹配了多行，会被更新多次，但是多次的0-0-1,1、通过插入顺序变更 构造更新顺序变更,2、通过hint方式构造顺序变更|create table T1(f1 int ,f2 int);,insert into T1values(1, 0);,create table T2(f1 int ,f2 int);,insert into T2values(1, 0);,insert into T2values(1, 1);|结果稳定，即使顺序被变更|  
|
|  
|同一行，匹配了多行，会被更新多次，但是多次的0-0-1-0-1-1,1、通过插入顺序变更 构造更新顺序变更,2、通过hint方式构造顺序变更|  
|  
|  
|
|  
|原本是 2-1-1-1-1来更新，等待的过程中，有其他session把 有一些满足条件的1 修改成其他值|  
|更新的值可能不稳定，但是不会报错|  
|
|  
|原本是 2-1-2来更新，等待的过程中，有其他session把 有一数据改成了 2-1-1|  
|更新值稳定为1|  
|
|  
|大数据量下的多表dml 并发|  
|  
|  
|
|merge into|同一行，匹配了多行，会被更新多次，但是多次的值是一样的2-1-1-1-1|  
|更新成功，即使顺序变更，也不会报错|  
|
|  
|同一行，匹配了多行，会被更新多次，但是多次的0-1-2-3,1、通过插入顺序变更 构造更新顺序变更,2、通过hint方式构造顺序变更|  
|会报错|  
|
|  
|同一行，匹配了多行，会被更新多次，但是多次的0-0-1,1、通过插入顺序变更 构造更新顺序变更,2、通过hint方式构造顺序变更|  
|顺序变更，结果有差异,0-0-1 更新成功,0-1-0，更新报错|  
|
|  
|同一行，匹配了多行，会被更新多次，但是多次的0-0-1-0-1-1,1、通过插入顺序变更 构造更新顺序变更,2、通过hint方式构造顺序变更|  
|顺序变更，结果有差异|  
|
|  
|原本是 2-1-1-1-1来更新，等待的过程中，有其他session把 有一些满足条件的1 修改成其他值|  
|更新会报错|  
|
|  
|原本是 2-1-2来更新，等待的过程中，有其他session把 有一数据改成了 2-1-1|  
|更新不会报错|  
|
|  
|同一行匹配多行，都满足删除条件|  
|会报错|  
|
|  
|同一行匹配多行，都满足删除条件，在等待过程中，其他session把一些满足条件的修改成不满足，只剩一条满足|  
|不会报错|  
|
|  
|大数据量下的merge into|  
|  
|  
|


### 3、DFX覆盖

|分类|场景说明|  
|
|---|---|---|
|性能|TPCC性能不下降|  
|
|  
|大数据量下多表dml和merge into性能|  
|
|CT/KT|当前已有用例看护即可|  
|
|一致性|当前已有用例看护即可|  
|


  


DFX覆盖情况

|系统级DFX分类|是否涉及|
|---|---|
|CT|涉及|
|KT|涉及|
|长稳|不涉及|
|一致性|涉及|
|三方测试工具    
  (sqltest，sqlancer)|不涉及|
|安全|不涉及|
|DFR|不涉及|
|HA|不涉及|
|压力|不涉及|
|性能|涉及|
|可维护性|不涉及|


  


# 4. 测试用例

1. 测试设计评审时提供冒烟文本用例；


|SR编号|SR名称|用例编号|用例测试点|测试点说明|
|:---|:---|:---|:---|---|
|YDBRD-26193|重复更新检测多表dml|test_sdv_ydbrd_26193_repeated_update_001|同一行，匹配了多行，会被更新多次，但是多次的值是一样的2-1-1-1-1（多表update）|  
|
|YDBRD-26193|重复更新检测多表dml|test_sdv_ydbrd_26193_repeated_update_002|同一行，匹配了多行，会被更新多次，但是多次的值是一样的2-1-1-1-1（多表delete）|  
|
|YDBRD-26193|重复更新检测多表dml|test_sdv_ydbrd_26193_repeated_update_003|同一行，匹配了多行，会被更新多次，但是多次的0-1-2-3（多表update）|  
|
|YDBRD-26193|重复更新检测多表dml|test_sdv_ydbrd_26193_repeated_update_004|同一行，匹配了多行，会被更新多次，但是多次的0-1-2-3（多表delete）|  
|
|YDBRD-26193|重复更新检测多表dml|test_sdv_ydbrd_26193_repeated_update_005|同一行，匹配了多行，会被更新多次，但是多次的0-0-1（多表delete）    
    
|  
|
|YDBRD-26193|重复更新检测多表dml|test_sdv_ydbrd_26193_repeated_update_006|同一行，匹配了多行，会被更新多次，但是多次的0-0-1（多表update）    
    
|  
|
|YDBRD-26193|重复更新检测多表dml|test_sdv_ydbrd_26193_repeated_update_007|where条件被其他session从满足条件被其他session修改成不满足--  filter条件被改变|create     table   test_multi_table_update_reinforce_025x_1(f1   int  ,f2   clob  ,f3   clob   ,f4   clob  ,f5   clob  )   lob   (f2,f3,f4,f5) STORE   AS   (  DISABLE     STORAGE     IN   ROW)  DISABLE   ROW MOVEMENT;    
  create     table   test_multi_table_update_reinforce_025x_2(f1   int  ,f2   clob  ,f3   clob   ,f4   clob  ,f5   clob  )   lob   (f2,f3,f4,f5) STORE   AS   (  DISABLE     STORAGE     IN   ROW)  DISABLE   ROW MOVEMENT;    
  insert     into   test_multi_table_update_reinforce_025x_1   values  (  1  ,  lpad  (  'a'  ,  100  ,  'b'  ),  'test1'  ,  '1000'  ,  lpad  (  'a'  ,  1000  ,  'b'  ));    
  insert     into   test_multi_table_update_reinforce_025x_1   values  (  2  ,  lpad  (  'a'  ,  100  ,  'b'  ),  'test1'  ,  '1000'  ,  lpad  (  'a'  ,  1000  ,  'b'  ));    
  insert     into   test_multi_table_update_reinforce_025x_1   values  (  3  ,  lpad  (  'a'  ,  100  ,  'b'  ),  'test1'  ,  '1000'  ,  lpad  (  'a'  ,  1000  ,  'b'  ));    
  insert     into   test_multi_table_update_reinforce_025x_1   values  (  4  ,  lpad  (  'a'  ,  100  ,  'b'  ),  'test1'  ,  '1000'  ,  lpad  (  'a'  ,  1000  ,  'b'  ));    
  insert     into   test_multi_table_update_reinforce_025x_1   values  (  5  ,  lpad  (  'a'  ,  100  ,  'b'  ),  'test1'  ,  '1000'  ,  lpad  (  'a'  ,  1000  ,  'b'  ));    
  insert     into   test_multi_table_update_reinforce_025x_1   values  (  6  ,  lpad  (  'a'  ,  100  ,  'b'  ),  'test1'  ,  '1000'  ,  lpad  (  'a'  ,  1000  ,  'b'  ));    
  insert     into   test_multi_table_update_reinforce_025x_1   values  (  7  ,  lpad  (  'a'  ,  100  ,  'b'  ),  'test1'  ,  '1000'  ,  lpad  (  'a'  ,  1000  ,  'b'  ));    
  insert     into   test_multi_table_update_reinforce_025x_1   values  (  8  ,  lpad  (  'a'  ,  100  ,  'b'  ),  'test1'  ,  '1000'  ,  lpad  (  'a'  ,  1000  ,  'b'  ));    
  insert     into   test_multi_table_update_reinforce_025x_1   values  (  9  ,  lpad  (  'a'  ,  250  ,  'b'  ),  'test1'  ,  '1000'  ,  lpad  (  'a'  ,  1000  ,  'b'  ));    
  insert     into   test_multi_table_update_reinforce_025x_1   values  (  10  ,  lpad  (  'a'  ,  250  ,  'b'  ),  'test1'  ,  '1000'  ,  lpad  (  'a'  ,  1000  ,  'b'  ));    
  commit  ;    
  insert     into   test_multi_table_update_reinforce_025x_2   values  (  1  ,  lpad  (  'a'  ,  200  ,  'b'  ),  'test1'  ,  '3000'  ,  lpad  (  'a'  ,  3000  ,  'b'  ));    
  insert     into   test_multi_table_update_reinforce_025x_2   values  (  2  ,  lpad  (  'a'  ,  200  ,  'b'  ),  'test1'  ,  '3000'  ,  lpad  (  'a'  ,  3000  ,  'b'  ));    
  insert     into   test_multi_table_update_reinforce_025x_2   values  (  3  ,  lpad  (  'a'  ,  200  ,  'b'  ),  'test1'  ,  '3000'  ,  lpad  (  'a'  ,  3000  ,  'b'  ));    
  insert     into   test_multi_table_update_reinforce_025x_2   values  (  4  ,  lpad  (  'a'  ,  200  ,  'b'  ),  'test1'  ,  '3000'  ,  lpad  (  'a'  ,  3000  ,  'b'  ));    
  insert     into   test_multi_table_update_reinforce_025x_2   values  (  5  ,  lpad  (  'a'  ,  200  ,  'b'  ),  'test1'  ,  '3000'  ,  lpad  (  'a'  ,  3000  ,  'b'  ));    
  insert     into   test_multi_table_update_reinforce_025x_2   values  (  6  ,  lpad  (  'a'  ,  200  ,  'b'  ),  'test1'  ,  '3000'  ,  lpad  (  'a'  ,  3000  ,  'b'  ));    
  insert     into   test_multi_table_update_reinforce_025x_2   values  (  7  ,  lpad  (  'a'  ,  200  ,  'b'  ),  'test1'  ,  '3000'  ,  lpad  (  'a'  ,  3000  ,  'b'  ));    
  insert     into   test_multi_table_update_reinforce_025x_2   values  (  8  ,  lpad  (  'a'  ,  200  ,  'b'  ),  'test1'  ,  '3000'  ,  lpad  (  'a'  ,  3000  ,  'b'  ));    
  insert     into   test_multi_table_update_reinforce_025x_2   values  (  9  ,  lpad  (  'a'  ,  200  ,  'b'  ),  'test1'  ,  '3000'  ,  lpad  (  'a'  ,  3000  ,  'b'  ));    
  insert     into   test_multi_table_update_reinforce_025x_2   values  (  10  ,  lpad  (  'a'  ,  200  ,  'b'  ),  'test1'  ,  '3000'  ,  lpad  (  'a'  ,  3000  ,  'b'  ));    
  commit  ;,--session1,update   test_multi_table_update_reinforce_025x_2   set   f2  =  lpad  (  'a'  ,  50  ,  'b'  ),f4  =  2000     where   f1  =  3  ;,--session2,update   test_multi_table_update_reinforce_025x_1 t1,test_multi_table_update_reinforce_025x_2 t2   set   t1.f4  =  t2.f4,t2.f5  =  t1.f5   where    t1.f1  =  t2.f1   and     LENGTH  (t1.f2)  <  length  (t2.f2);|
|YDBRD-26193|重复更新检测多表dml|test_sdv_ydbrd_26193_repeated_update_008|where条件被其他session修改成不满足到满足--filter条件被改变|--session1,update   test_multi_table_update_reinforce_025x_2   set      f2  =  lpad  (  'a'  ,  50  ,  'b'  ),f5  =  lpad  (  'a'  ,  2000  ,  'b'  ))   where   f1  =  9  ;,--session2,update   test_multi_table_update_reinforce_025x_1 t1,test_multi_table_update_reinforce_025x_2 t2 ,set   t1.f4  =  t2.f4,t2.f5  =  t1.f5   where    t1.f1  =  t2.f1   and     LENGTH  (t1.f2)  <  length  (t2.f2);|
|YDBRD-26193|重复更新检测多表dml|test_sdv_ydbrd_26193_repeated_update_009|where条件被其他session从满足条件被其他session修改成满足到满足--filter条件被改变|--session1,update   test_multi_table_update_reinforce_025x_2   set      f2  =  lpad  (  'a'  ,  80  ,  'b'  ),f5  =  lpad  (  'a'  ,  2000  ,  'b'  )   where   f1  =  3  ;,--session2,update   test_multi_table_update_reinforce_025x_1 t1,test_multi_table_update_reinforce_025x_2 t2 ,set   t1.f4  =  t2.f4,t2.f5  =  t1.f5   where    t1.f1  =  t2.f1   and     LENGTH  (t1.f2)  <  length  (t2.f2);|
|YDBRD-26193|重复更新检测多表dml|test_sdv_ydbrd_26193_repeated_update_010|不同session修改同一行数据的同一列|--session1    
  update test_T1 set f4=f4+100 where f1=4;    
  --session2    
  update test_T1 t1,test_T2 t2 set t1.f4=t2.f4 where t1.f2<150;    
  --session1    
  commit;    
  select * from test_T1;    
  --session2    
  commit;    
  select * from test_T1;|
|YDBRD-26193|重复更新检测多表dml|test_sdv_ydbrd_26193_repeated_update_011|SET 要改的列和filter条件同时发生改变|--session1    
  update test_T1 set f2=110 where f1=4;    
  update test_T2 set f2=120 where f1=4;    
  --session2    
  update test_T1 t1,test_T2 t2 set t1.f4=t2.f4,t1.f2=t2.f2 where t1.f2<150;    
  --session1    
  commit;    
  select * from test_T1;    
  --session2    
  commit;    
  select * from test_T2;|
|  
|  
|  
|  
|  
|


       2.启动测试之前提供文本用例，并完成大部分自动化用例；

详见附件

# 5. 测试框架设计

- 精准看护用例在yasft种可以看护
- 并发和一致性yastx和yasct可以覆盖
- 性能当前的tpcc工程就可以看护


# 6. 测试环境说明

*测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等*

# 7. 工作量评估

工作量：  *xx人天*

计划测试完成时间：

  [详细测试设计文档模板.doc](#)  

## Comments:

|  [](null)  ,主题：重复更新检测多表update 测试设计    
  与会人：李燕琼、张志鹏、郑荃、曾昭瀚    
  会议时间：2024/11/1  15:00-15:30    
  会议地点：线上会议    
  会议纪要:,1、lob是通过locator的方式判断是否会重启，可能存在问题,2、本次不涉及自治事务和XA事务,3、补充大数据量下多表update的并发,Posted by zhengquan at 十一月 04, 2024 16:02|
|---|


