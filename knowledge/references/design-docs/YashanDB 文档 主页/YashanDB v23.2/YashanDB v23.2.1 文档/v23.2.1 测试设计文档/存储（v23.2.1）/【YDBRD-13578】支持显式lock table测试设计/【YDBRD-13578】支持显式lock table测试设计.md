Created by 刘丹, last modified by  郑荃 on 三月 07, 2024

# **1. 概述**

使用该语句可以锁定表的视图并允许或拒绝其它用户在操作期间访问表或者视图;加锁模式包括share、exclusive

数据库一般有2种锁：排它锁（X）和共享锁（S）

S锁是指可以查看数据但无法修改和删除数据的一种数据锁，若事务1对数据对象A加上S锁，则事务2只能读A；其他事务只能再对A加S锁，而不能加排他X锁，直到事务1释放A上的S锁。这就保证了其他事务可以读A，但在事务1释放A上的S锁之前不能对A做任何修改。

如果事务1对数据或数据对象A加上X锁后，则其他事务不能再对A加任何类型的锁。获得X锁的事务既能读数据，又能修改数据。

# **2. 需求分析**

### 2.1 SR: 【23.2】支持显式lock table

链接：    [[YDBRD-13578] 支持显式lock table - SICS-CoD Jira (yasdb.com)](https://jira.yasdb.com/browse/YDBRD-13578)  

开发设计：    [Lock Table设计文档 - 王博文 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=119558040)  

场景：

功能：

      1.对表、视图、物化视图对象加锁，确保事务的一致性

功能限制：

      1.不支持dblink

      2.不支持给分区表的分区单独加锁

      3.只支持share和exclusive



### 2.2语法

**提供语法：LOCK TABLE table_name IN lockmode MODE waitmode;**

![](https://conf.yasdb.com/download/attachments/119558040/image2023-10-17_17-7-14.png?version=1&modificationDate=1697533359000&api=v2?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTc2NTAsImV4cCI6MTc4MjMwODQ1MH0.McNUjtJCYFvCmXoUkbEweRZwdB1pd_Qz56OJ9sBCtRg)

**备注：如果您既不指定**  **NOWAIT**  **也不指定**  **WAIT**  **，则数据库将无限期地等待，直到表可用，锁定它，并将控制权返回给您。**

**lockmode的参数详解**

|lock_mode|描述|
|---|---|
|SHARE|允许并发查询，但用户无法更新锁定的表。|
|EXCLUSIVE|独占模式，不允许其他用户修改该表。|


**动态视图：v$locked_object，v$lock**

字段及含义如下：

|字段|数据类型|描述|
|:---|:---|:---|
|OBEJECT_ID|uint64，not null|被加锁的对象的OID|
|SESSION_ID|uint16，not null|当前持锁的会话ID|
|LMODE|varchar(8)|被加锁的锁类型|


v$lock:

|字段|数据类型|描述|
|---|---|---|
|SID|SMALLINT|会话ID|
|ID1|BIGINT|锁的标识符    
  1.如果是会话持有的锁    
  当锁类别为表锁，ID1记录了表的ID    
  当锁类别为行表行锁/键值锁/列表行锁， ID1记录了行/索引键/列表中的行所在的页面ID    
  2.如果是会话等待的锁    
  当等待的锁类别为表锁，ID1记录了表的ID    
  当等待的锁类别为行锁/键值锁/列表行锁， ID1记录了持有该行锁/键值锁/列表行锁的事务ID|
|ID2|BINGINT|锁的标识符    
  * 如果是会话持有的行锁，ID2记录了该行所对应的Xslot ID    
  * 其他情况下ID2为空|
|LOMODE|VARCHAR(32)|会话持有的锁类型    
  * TS：共享表锁    
  * TX：排他表锁    
  * ROW：行锁    
  * KEY：键值锁    
  * SLICE_S：LSC表slice共享锁    
  * SLICE_X：LSC表slice排他锁|
|REQUEST|VARCHAR(32)|会话等待的锁类型    
  * TS：共享表锁    
  * TX：排他表锁    
  * ROW：行锁    
  * KEY：键值锁    
  * SLICE_S：LSC表slice共享锁    
  * SLICE_X：LSC表slice排他锁|


**3. 测试**  **设计方法**   

### 3.1 特性关联领域分析：

1.部署模式是单机和集群

2.对lock table语法做一个覆盖验证

3.加锁后可以通过ddl操作或者commit和rollback操作来释放锁

4.加锁后可以通过视图查看锁

5.不同之处：dml操作加的是共享锁

### **3.2 **  梳理该特性是否涉各个专项测试，并在详细设计中描述具体测试点

|专项|是否涉及|
|:---|:---|
|并发|是|
|长稳|否|
|一致性|否|
|三方测试工具    
  (sqltest，sqlancer)|否|
|安全|否|
|DFR/testkill|否|
|HA|否|
|压力|否|
|性能|否|
|可维护性|否|
|资料|是|


### 3.3测试设计：

语法验证部分采用等价类划分，对不同的参数做正交验证组合

测试关注点：

1.加锁后，未加锁的事务会出现等待的现象

2.加锁后对应的v$lock视图可以查询到锁

3.ddl操作和rollback，commit，kill session等会释放锁

# 4.   **详细测试设计**   

涉及对象：表、视图、物化视图、fixed view，DBA视图（user视图，all视图）系统表

语句：  **LOCK TABLE table_name IN lockmode MODE waitmode;**

### 4.1：语法验证

|输入条件|有效等价类|无效等价类|预期报错|
|---|---|---|---|
|**LOCK TABLE table_name IN 【lockmode】MODE waitmode;**|**LOCK TABLE table_name IN **  **SHARE**  ** MODE wait 7；**|少lockmode关键字|缺失 MODE 关键字|
|  
|**LOCK TABLE table_name IN **  **SHARE**  ** MODE nowait；**|少in关键字|提示缺少in关键字|
|  
|**LOCK TABLE table_name IN **  **SHARE**  ** MODE；**|table_name缺失或者不存在|表名无效|
|  
|**LOCK TABLE table_name IN **  **EXCLUSIVE **  ** **  **MODE;**|mode缺失|缺失 MODE 关键字|
|  
|**LOCK TABLE table_name IN EXCLUSIVE MODE nowait; **|table_name重复|提示缺少in关键字|
|  
|**LOCK TABLE table_name IN **  ** EXCLUSIVE**  ** **  **MODE wait 7;**|lockmode 重复|缺失 MODE 关键字|
|  
|  
|锁类型拼写错误|提示缺少in关键字|
|  
|  
|lock view/materialzied view|缺失 TABLE 关键字|
|  
|  
|不存在的schema|表或视图不存在|
|  
|  
|table_name是系统表名，fixed view，动态视图名称|只能从固定的表/视图查询/权限不足|


**4.2功能验证**

|  
|session1（步骤）|session2（步骤）|预期|备注|
|---|---|---|---|---|
|share    
    
|1.创建一个表，并给表加SHARE锁，使用视图查询该锁,  
,2.commit释放锁，并在视图中查询|1.查询中的数据,2.插入数据,3.插入数据成功,  
|成功,成功|  
|
||1.创建一个表，给表加SHARE锁，使用视图查询,2.更新表中的一行数据,  
,  
,3.提交更改的事务释放锁,4.drop表|1.查询表中的数据，并加SHARE锁,  
,2.使用rollback释放锁,3.在添加SHARE锁并使用nowait参数，并在视图中查询表,  
|成功,成功,  
,成功,  
,等待|  
|
||1.创建一个表，给表加SHARE锁，使用视图查询,2.断开session，释放锁,3.做dml操作（不提交dml操作）,  
,  
,4.提交dml操作,5.给表添加一个列|1.查询表中的数据，并给表加EXCLUSIVE锁,  
,  
,2.commit释放锁,3.在加一个SHARE锁,4.视图中查询锁,  
|等待,session2的exclusive加锁成功,等待,session1数据更新成功,成功,成功,等待|  
|
||1.做dml操作,  
,2.commit释放锁,3.表加SHARE锁,4.drop掉表|1.加SHARE锁,2.给表add一个列,  
,3.表做dml操作|成功,等待,add成功,锁添加成功，dml操作成功,等待|  
|
|EXCLUSIVE|1.创建表并添加exclusive锁,2.给表添加一个列，|1.视图查询，表查询，dml操作更新数据,  
,2.提交dml操作的结果,3.添加share锁|等待,session1的ddl操作等待，session2的dml操作完成,session1结束等待，add列成功,成功|  
|
||1.给表添加一个exclusive锁,2.drop掉表的一个列,  
|1.给表添加一个share锁,  
,2.加一个EXCLUSIVE锁，使用wait参数|等待,session1报资源在忙，session2的share 锁添加成功,成功|  
|
||1.表添加一个exclusive锁，,  
,2.释放锁,3.做数据更新操作|1.给表也添加一个exclusive锁，并使用wait参数,2.重新给表添加exclusive锁，wait参数设置20，,3.等待过程中加锁成功,  
|等待后报超时,等待,  
,等待|  
|


**4.3场景验证（特有场景）**

|  
|  
|场景|预期|备注|
|---|---|---|---|---|
|1|  
  物化视图    
    
|session1创建物化视图和表，对物化视图和表加共享锁，session2中使用高级包刷新物化视图，并将ATOMIC_REFRESH参数设置为true|成功|  
|
|||session1创建物化视图和表，对物化视图和表加共享锁，session2中使用高级包刷新物化视图，并将ATOMIC_REFRESH参数设置为false|等待，资源超时|  
|
|||session1创建物化视图和基表，并物化视图加共享锁，session2对基表进行dml操作，并让物化视图commit刷新|commit刷新|  
|
|||session1创建物化视图和基表，并对物化视图进行加排它锁，在session2中drop基表；使用高级包刷新|报表不存在|  
|
|||session1创建物化视图和基表，对基表加排它锁，在session2中对物化视图加排它锁，并使用高级包刷新|等待|  
|
|||  
|  
|  
|
|2|视图|session1给表A加共享锁，并创建视图B，session2中给视图B加共享锁，在给视图B加排它锁|共享锁添加成功，排它锁等待|  
|
|  
|  
|session1给表A加排它锁，并创建视图B，session2给视图B加共享锁，同时session1做drop基表的操作，|session2在drop基表的时候共享锁添加成功，session1显示超时|  
|
|3|权限|新建用户A，给用户A创建表和视图的权限，使用lock  table对表或者视图加锁|成功|  
  覆盖2种锁类型（只需要select view权限）|
|  
|  
|新建用户A，B，在A下创建表，在用户B下创建基于用户A下表的视图，给用户B下的视图加锁，在用户B下给用户A的表加锁|成功||
|  
|  
|新建用户A,B，在A下创建表，在用户B下对用户A创建的表加锁|成功||
|  
|  
|只需要select view|  
||
|4|死锁|session1下面加排它锁，session2下面加排它锁；session1和sesion2同时插入数据|其中一个session会报等待资源时检测到死锁|  
|
|5|同义词|session1创建表A，和A同义词是B，给B加锁|  
|  
|
|  
|  
|  
|  
|  
|
|6|savepoint|session1在事务开始前记录保存点a,事务做一次dml后记录保存点b；session2给表加一个排它锁，然后在session1将事务回滚到记录b|等待|  
|
|  
|  
|session1在事务开始前记录保存点a,事务做一次dml后记录保存点b；session2给表加一个排它锁，然后在session1将事务回滚到记录a|成功|  
|
|7|wait参数|session1加共享锁，session2加排它锁，不使用wait或者nowait参数，观察是否一直等待|一直等待|  
|
|  
|  
|等待时间是否正确，|  
|  
|
|  
|  
|不配置参数，用不超时|  
|  
|
|8|拦截|分区表，dblink,，其余4种|  
|  
|
|9|kill|kill yasql,kill yasdb ,alter system kill session ，exit锁是否释放|退出释放锁|  
|
|  
|  
|sesion退出|  
|  
|
|  
|fixed view|  
|报错|  
|
|10|GV集群|  
|  
|  
|


  


**4.4.权限**

**ps:给用户1create session和create table的权限，user1和user2均属于普通用户**

|序号|user1(创建表A，并给用户2操作表A的权限）|user2|预期|
|---|---|---|---|
|  
    
    
    
  1（表级对象权限）|grant ALL PRIVILEGES on  A    
|lock table user1.A    
    
    
    
|加锁成功    
    
    
    
|
||grant update on A|  
||
||grant insert on A|  
||
||grant select on A,grant select on  user1.view1 to user2|lock table user1.A–成功,lock table user1.view1--成功||
||grant delete on A|  
||
||grant alter on A|  
||
||grant index on A|  
||
||grant flashback  on A|  
||
||grant read on A|lock table user1.A|加锁失败|


ps:基表的对象是sys用户，在普通用户进行锁表操作

**ps:sys用户和普通用户**

  


|  
|sys用户|普通用户||预期|||||
|---|---|---|---|---|---|---|---|---|
|1    
    
|在sys用户下直接对系表加锁|  
    
||加  锁成功|||||
||  
|  
  对系统表加锁||权限不足|||||
|2|基于系统表创建视图view1，给普通用户dba权限|对视图加锁||权限不足|||||
|3|基于系统表创建视图view1，给普通用户select视图的权限|对view1加锁||报sys用户不能被非sys用户锁定|||||
|4|创建表和视图|对表和视图加锁||sys用户不能被非sys用户锁定|||||
|5|sys用户下对dba用户下创建的表和视图加锁|  
||成功|||||
|6|  
|普通用户下创建表和视图，dba用户下锁定||成功|||||


**质量加固用例补充**

|功能点|场景详细说明|预期|备注|
|---|---|---|---|
|savepoint|几个savpoint 点，然后依次释放,1、dml开启事务,2、在事务中创建savpoint a1,3、lock table table1, table2 ,table3(加排他锁或者共享锁),4、在事务中创建savpoint a2,5、lock table table3, table4 ,table5(加排他锁或者共享锁)，跟上面部分交互,6、在事务中创建savpoint a3,7、lock table table4 ,table5 表锁类型跟第五步的锁一样或者不一样,。。。。。等等,然后再一次回滚savepoint点,  
|  
|覆盖表、视图、物化视图|
|同义词|给对象创建同义词，然后通过同义词加锁，锁未释放，删除同义词|  
|覆盖表、视图、物化视图|
|  
|给对象创建同义词，然后一个session通过同义词加锁，一个session通过对象加锁|  
|覆盖表、视图、物化视图|
|多个对象一起加锁|多个不同的对象同时加锁,1、多个对象中有同名对象重复,2、加锁的对象是不同类型的，有view，table，物化视图,3、多个加锁的对象互相依赖|  
|  
|
|  
|多个对象加锁的上限，最多支持多少个对象一起加锁|  
|  
|
|  
|把LOCK_POOL_SIZE设置的很小，然后给多个对象加锁，看是否会出现锁区不足的情况|  
|  
|
|  
|一个view关联了非常多张表和物化视图，给view加锁|  
|  
|
|结合alter session|用户1 有tablea的对象， 用户2也有tablea的对象,conn 用户1ALTER SESSION SET current_schema=用户2;    
  lock table tablea 查看加锁的表所在的用户|  
|  
|
|锁升级和降级|1、先给表加共享锁再加排他锁， 共享锁升级成排他锁,2、先给表加排他锁再加共享锁，排他锁降级成共享锁|这块机制有可能跟oracle不一样，oracle会升级成一个锁，yashandb两个锁可以共存|  
|
|GV视图看护|集群上增加GV视图的查询gv$lock和gv$locked_object;,  
|  
|已经覆盖这种权限|
|跟read权限结合|只有read权限是否可以加锁成功，可以跟oracle对比下|  
|已经覆盖这种权限|


# 5.   **测试用例**

# 6.   **测试框架设计**

基础语法部分采用yat框架，session切换采用ha框架

# 7.   **测试环境说明**

|服务器|  
|
|:---|:---|
|操作系统|Linux|
|部署|单机|


## Attachments:

[整库拷贝后的路径转换.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiZTU4OTcwYzJhZjRmNTIwN2UyIiwicmVmX2lkIjoiNjczOTZiZTU3MjgyMDZlZmI5MmYwYjQyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk3NjUwLCJleHAiOjE3ODIzODQwNTB9.g3dHqhvQj4jBM-xxWd9X8IDMUzESpDBqQME9eWMQ_xk)

 (application/x-xmind)    


[content_1686877662939.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiZTVhMWFkOWEzMzExZGM4NjU5IiwicmVmX2lkIjoiNjczOTZiZTU3MjgyMDZlZmI5MmYwYjQyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk3NjUwLCJleHAiOjE3ODIzODQwNTB9.teU5OJCpsYK9OJoTEZcDgyGyCc5QlOEGUPjqj6Sv28g)

 (application/x-xmind)    


[lock table文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiZTU4OTcwYzJhZjRmNTIwN2U0IiwicmVmX2lkIjoiNjczOTZiZTU3MjgyMDZlZmI5MmYwYjQyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk3NjUwLCJleHAiOjE3ODIzODQwNTB9.G-HT8XAm9dZnGlmx97RUkl8Azr2GeQr8xoan4-mRq-Y)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    
