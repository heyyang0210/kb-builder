Created by 鄢红亮, last modified by  许中立 on 一月 30, 2024

  [YDBRD-14078](https://jira.yasdb.com/browse/YDBRD-14078?src=confmacro)    -  分布式支持row movement  完成

# **1. 概述**

**行迁移功能允许数据的存储位置发生改变，该特性为跨分区更新功能提供支持。当用户将数据存在一个分区表中，如果更新数据时会引起分区变化，则需要行迁移功能的支持。**

# **2. 需求分析**

## 2.1语法

**开启行迁移**

**enable row movement 该语句用于开启行迁移功能。**

**用户根据需要在建表后执行本SQL语句来开启行迁移功能：**

**alter**  ** **  **table**  ** TABLE_NAME **  **enable**  ** **  **row**  ** **  **movement**  **;**

**TABLE_NAME：表名。**

**enable row movement 开启行迁移功能。**

**示例**

**create**  ** **  **table**  ** TABLE1(**  **key**  ** **  **int**  **) **  **organization**  ** **  **heap**  **;**  **alter**  ** **  **table**  ** TABLE1 **  **enable**  ** **  **row**  ** **  **movement**  **;**  **  
**  **关闭行迁移**

**disable row movement 该语句用于关闭行迁移功能。**

**删除语句**

**alter**  ** **  **table**  ** TABLE_NAME **  **disable**  ** **  **row**  ** **  **movement**  **;**

**示例**

**alter**  ** **  **table**  ** TABLE1 **  **disable**  ** **  **row**  ** **  **movement**  **;**  **  
**

## 2.2 功能描述

- **用户建表时默认不开启行迁移功能，需要用户通过sql语句手动打开一致性开关。**
- **需要row movement开启的情况有闪回DML、shrink table和跨分区更新。分布式目前支持的rowId发生变化的场景只有一种：tac表的跨分区更新。**
- **跨分区更新在分布式上表现为支持dn节点内的跨分区更新，不涉及跨节点，即不能更新分布键。**
- **目单机只有tac表和heap表支持开启、关闭行迁移，lsc表不支持开启，分布式下不支持heap，因此只有tac支持开启行迁移。**
- **其余约束与当前alter table保持一致**


**  
**

# **3. 测试设计方法**

|row movement|语法|alter table|Alter table table_name enable row movement;|  
|  
|  
|  
|
|---|---|---|---|---|---|---|---|
||||Alter table table_name disable row movement;|  
|  
|  
|  
|
||||table 中加上schema|  
|  
|  
|  
|
||||table 名不加schema|  
|  
|  
|  
|
|||create_table|create table table_name (a int) enable row movement;|  
|  
|  
|  
|
||||create table table_name (a int) disable row movement;|  
|  
|  
|  
|
||||临时表|global|  
|  
|  
|
|||||private|  
|  
|  
|
||||relation_properties|约束|外键|  
|  
|
||||||唯一|  
|  
|
||||||主键约束|  
|  
|
||||||default|  
|  
|
||||||非空|  
|  
|
|||||索引|普通索引|  
|  
|
||||||本地索引（分区表）|  
|  
|
||||table_properties|表存储类型|列存|tac|  
|
|||||||lsc|ac|
|||||分区表|list|  
|  
|
||||||hash|  
|  
|
||||||range|  
|  
|
||||||interval|不支持|  
|
||||row_movement_clause|enable|  
|  
|  
|
|||||disable|  
|  
|  
|
|||表空间|自定义表空间|  
|  
|  
|  
|
||||临时表空间|分布式不支持|  
|  
|  
|
||场景|闪回DML分布式不支持|开启row movement|_CONSISTENT_WRITE|开启|  
|  
|
||||||关闭|  
|  
|
||||闪回DML和DML操作并发|写一致性|  
|  
|  
|
||||闪回DML过程中做查询|读一致性|  
|  
|  
|
|||Shrink Table分布式不支持|开启row movement|  
|  
|  
|  
|
||||_CONSISTENT_WRITE|开启|  
|  
|  
|
|||||关闭|  
|  
|  
|
||||Shrink Table 过程中，并发DML操作（正在被修改的数据已经被搬移）|写一致性|  
|  
|  
|
||||Shrink Table 过程中做查询（正在被读取的数据已经被搬移）|读一致性|  
|  
|  
|
||||Shrink Table 过程中 ，增删改查并发|  
|  
|  
|  
|
|||跨分区更新|开启row movement|  
|  
|  
|  
|
||||_CONSISTENT_WRITE|开启|  
|  
|  
|
|||||关闭|  
|  
|  
|
||||跨分区更新和DML并发(正在修改的数据被更新到其他分区)|写一致性|  
|  
|  
|
||||跨分区过程中做查询|读一致性|  
|  
|  
|
||||跨分区过程中，增删改查并发|跟DDL并发，不关注结果|update c1=c2,c1不是分布键，然后删掉c2|  
|  
|
|||索引|带索引|是否回表|  
|  
|  
|
|||||分区表考虑全局，本地索引|不支持|  
|  
|
||||不带索引|  
|  
|  
|  
|
|||DML场景下的一致性|row movement 开启|_consistent_write关闭|会重启|  
|  
|
|||||_consistent_write开启|会重启|  
|  
|
||||row movement 关闭|_consistent_write开启|会重启|  
|  
|
|||||_consistent_write关闭|不会重启|  
|  
|
||||merge into|  
|  
|  
|  
|
|||各种场景混合并发|  
|  
|  
|  
|  
|
|||长更新、长删除场景下filtert条件数据反复被并发修改|  
|  
|  
|  
|  
|
|||视图|动态视图v$sql, v$sqlArea 中增加restart_statements列 ，统计语句重启次数正确|  
|  
|  
|  
|
||补充场景|语句重启|再cn上进DML(delete、update、merge等)操作不提交事务，dn上再进行DML操作(30秒报错)|  
|  
|  
|  
|
||||多事务上DML和DML的并发操作|  
|  
|  
|  
|
||||row movement 开启|_consistent_write关闭|会重启|  
|  
|
|||||_consistent_write开启|会重启|  
|  
|
||||row movement 关闭|_consistent_write开启|会重启|  
|  
|
|||||_consistent_write关闭|不会重启|  
|  
|
||||配置重启时间(30s)|  
|  
|  
|  
|
||||节点间进行DML操作|  
|  
|  
|  
|
||||回闪DML操作|  
|  
|  
|  
|
|||分布键拦截|直接跨分区更新分布键|row movement 开启|_consistent_write关闭|  
|  
|
||||||_consistent_write开启|  
|  
|
||||||row movement 开启|  
|  
|
|||||row movement 关闭|_consistent_write开启|  
|  
|
||||||_consistent_write关闭|  
|  
|
||||一列即为分布键又为分区键|row movement 开启|_consistent_write关闭|  
|  
|
||||||_consistent_write开启|  
|  
|
|||||row movement 关闭|_consistent_write开启|  
|  
|
||||||_consistent_write关闭|  
|  
|
|||大数据量的场景|  
|  
|  
|  
|  
|
|||部署|分布式|HA环境，节点间进行DML并发操作|row movement 关闭|_consistent_write开启|  
|
|||||||_consistent_write关闭|  
|
||||||YDBRD-11971，根据问题单发散测试|  
|  
|
|||覆盖数据类型|  
|  
|  
|  
|  
|
|||异常场景|帐不平的情况|  
|  
|  
|  
|
||||改分区键|  
|  
|  
|  
|
||||节点故障|  
|  
|  
|  
|
||||性能，高并发，开行迁移和没有开行迁移的情况对比|  
|  
|  
|  
|


**语句重启性能测试**

**drop table if exists t1;**    
  **CREATE TABLE t1(accountid int, money int, comments varchar(255))partition by hash(accountid)(partition p1,partition p2,partition p3)organization tac;**    
  **begin**    
  **for i in 1..100 loop**    
  **insert into t1 values(i+1,1000+i,i+1);**    
  **commit;**    
  **end loop;**    
  **end;**    
  **/**    
  **alter table t1 enable row movement;**    
  **alter table t1 disable row movement;**

**分布式–并发语句**

**事务1**

**delete from t1;**    
  **insert into t1 values(111,1111,111); **    
  **commit;**

**事务2**

**delete from t1 where money=1050;**    
  **insert into t1 values(112,1112,112);**    
  **commit;**

|**并发**|**开启行迁移**|**关闭行迁移**|**效率/单位**|
|---|---|---|---|
|**32**|**5 **|**2 **|**秒**|
|**64**|**14**|**3**|**秒**|
|**128**|**30**|**4**|**秒**|
|**256**|**47，没有卡住，有报错情况下**|**10**|**秒**|


**分布式–并发语句**

**事务1**

**delete from t1;**    
  **insert into t1 values(111,1111,111); **    
  **commit;**

|**并发**|**开启行迁移**|**关闭行迁移**|**效率/单位**|
|---|---|---|---|
|**32**|**3**|**1**|**秒**|
|**64**|**9**|**1**|**秒**|
|**128**|**31**|**2**|**秒**|
|**256**|35  **有报错情况下**|**2**|**秒**|
|512|53  **有报错情况下**|8|秒|


**单机–并发语句**

**事务1**

**delete from t1;**    
  **insert into t1 values(111,1111,111); **    
  **commit;**

|**并发**|**开启行迁移**|**关闭行迁移**|**效率/单位**|
|---|---|---|---|
|**32**|0|0|**秒**|
|**64**|1|0|**秒**|
|**128**|2|1|**秒**|
|**256**|4|1|**秒**|
|512|8|3|秒|


#### 分布式1CN1DN  **–并发语句**

#### **事务1**

#### **delete from t1;**    
  **insert into t1 values(111,1111,111); **    
  **commit;**

|#### **并发**|#### **开启行迁移**|#### **关闭行迁移**|#### **效率/单位**|
|---|---|---|---|
|#### **32**|#### 2|#### 1|#### **秒**|
|#### **64**|#### 5|#### 1|#### **秒**|
|#### **128**|#### 18|#### 1|#### **秒**|
|#### **256**|#### 33|#### 2|#### **秒**|
|#### 512|#### 33  **有报错情况下**|#### 5|#### 秒|


#### YAS-02208 lock conflict in consistent write

#### YAS-06511 failed to allocate 176 bytes

# **4. 详细测试设计**

[row movement.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZDQ4OTcwYzJhZjRmNTFmYWM2IiwicmVmX2lkIjoiNjczOTY5ZDQ1OTNmOTljOWZmMjM1MzVjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA5Mjc5LCJleHAiOjE3ODIyOTU2Nzl9._WlJtfOVD98P3SUqqCdhXiIyymukWZJ29edWIkbBjiU)

# **5. 测试用例**

测试设计细化后的文本用例

详见：    [https://git.yasdb.com/cod-test/yasft/-/tree/master/distribution/testcase/function3/OLAP_func](https://git.yasdb.com/cod-test/yasft/-/tree/master/distribution/testcase/function3/OLAP_func)  

# **6. 测试框架设计**

1. **本次测试采用**  **Guider**  **测试框架实现，执行sql文件，对比期望结果与输出结果，输出测试结果。**


# **7. 测试环境说明**

|**服务器类型**|**操作系统**|**服务器个数**|**部署节点**|
|:---|:---|:---|:---|
|**VM**|**Linux**|**1**|  
|


## Attachments:

[row movement.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZDQ4OTcwYzJhZjRmNTFmYWM2IiwicmVmX2lkIjoiNjczOTY5ZDQ1OTNmOTljOWZmMjM1MzVjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA5Mjc5LCJleHAiOjE3ODIyOTU2Nzl9._WlJtfOVD98P3SUqqCdhXiIyymukWZJ29edWIkbBjiU)

 (application/x-xmind)    
