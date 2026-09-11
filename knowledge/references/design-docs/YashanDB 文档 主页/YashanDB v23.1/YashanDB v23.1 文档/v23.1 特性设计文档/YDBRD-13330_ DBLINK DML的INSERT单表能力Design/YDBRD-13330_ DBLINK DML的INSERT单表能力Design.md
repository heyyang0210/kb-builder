Created by 林永豪, last modified by  胡波洋 on 七月 04, 2023

  [1. Overview（概述）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#1-overview%E6%A6%82%E8%BF%B0)  

支持dblink 单表insert数量到远端表。

SR链接：    [YDBRD-13330](https://jira.yasdb.com/browse/YDBRD-13330?src=confmacro)    -  实现DBLINK DML的INSERT单表能力  完成

##   [3. Interfaces（接口）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#3-interfaces%E6%8E%A5%E5%8F%A3)  

#### 语法形式：

支持以下语法形式：其中tb为表名， test_dblink,为创建的dblink名称

1. insert into tb@test_dblink values(xx);  // 不指定column名单行插入
1. insert into  tb@test_dblink (column) values(xx); // 指定column名单行插入
1. insert into tb@test_dblink values(xx), (xx), (xx); // 不指定column名多行插入
1. insert into tb@test_dblink values (column) (xx), (xx), (xx); // 指定column名多行插入
1. 支持在存储过程中使用上述语法执行dblink 单表插入， 存储过程insert 常量和绑定变量作为参数。


**dblink insert 远端表支持的数据类型**

|yasdb|映射到oracle数据类型|oracle dblink|oracle dblink 用例|
|---|---|---|---|
|DTYPE_TINYINT|SQLT_INT    
    
  ociSize：sizeof(CodUint32)|int|  
    
    
|
|DTYPE_SMALLINT||||
|DTYPE_INTEGER||||
|DTYPE_BIGINT|SQLT_INT,ociSize： sizeof(CodUint64)|无|无|
|DTYPE_FLOAT|SQLT_BFLOAT,ociSize :sizeof(CodFloat)|支持|SQL> declare    
  2 a float := 1.11;    
  3 begin    
  4 insert into t3@test_dblink values(a) ;    
  5 end;    
  6 /,PL/SQL 过程已成功完成。|
|DTYPE_DOUBLE|SQLT_BDOUBLE|支持|SQL> declare    
  2 a binary_double := 2.11;    
  3 begin    
  4 insert into t3@test_dblink values(a) ;    
  5 end;    
  6 /,PL/SQL 过程已成功完成。|
|DTYPE_NUMBER|SQLT_STR|支持|SQL> declare    
  2 a number := 1.11;    
  3 begin    
  4 insert into t3@test_dblink values(a) ;    
  5 end;    
  6 /,PL/SQL 过程已成功完成。|
|DTYPE_YM_INTERVAL|SQLT_INTERVAL_YM|支持|SQL> declare    
  2 a interval year to month := '11-4';    
  3 begin    
  4 insert into t3@test_dblink values(a) ;    
  5 end;    
  6 /,PL/SQL 过程已成功完成。|
|DTYPE_DS_INTERVAL,  
,  
,**|SQLT_INTERVAL_DS|支持|SQL> declare    
  2 a interval day to second := '11 20:22:22';    
  3 begin    
  4 insert into t3@test_dblink values(a) ;    
  5 end;    
  6 /,PL/SQL 过程已成功完成。|
|DTYPE_DATE ,  
,**|SQLT_DAT|支持|  
  SQL> declare    
  2 a date := '2021-07-12';    
  3 begin    
  4 insert into t3@test_dblink values(a) ;    
  5 end;    
  6 /,PL/SQL 过程已成功完成。|
|DTYPE_TIMESTAMP|SQLT_TIMESTAMP|支持|SQL> declare    
  2 a timestamp := to_timestamp('2011-09-14 12:52:42.123456789', 'syyyy-mm-dd hh24:mi:ss.ff');    
  3 begin    
  4 insert into t3@test_dblink values(a) ;    
  5 end;    
  6 /,PL/SQL 过程已成功完成。|
|~~DTYPE_TIMESTAMP_TZ~~|~~yasdb暂未支持的数据类型~~|  
|  
|
|~~DTYPE_TIMESTAMP_LTZ~~|~~yasdb暂未支持的数据类型~~|  
|  
|
|DTYPE_CHAR|  
  SQLT_STR    
    
    
|支持|  
|
|~~DTYPE_NCHAR~~|~~yasdb暂未支持的数据类型~~|  
|  
|
|DTYPE_VARCHAR|SQLT_STR|支持|  
|
|~~DTYPE_NVARCHAR~~|~~yasdb暂未支持的数据类型~~|  
|  
|
|DTYPE_CLOB|不支持|不支持|  
  SQL> declare    
  2 a clob := '1';    
  3 begin    
  4 insert into t3@test_dblink values(a) ;    
  5 end;    
  6 /    
  declare    
  *    
  第 1 行出现错误:    
  ORA-65503: 无法通过数据库链接发送或接收临时 LOB 定位符    
  ORA-02063: 紧接着 line (起自 TEST_DBLINK)    
  ORA-06512: 在 line 4|
|~~DTYPE_NCLOB~~|~~yasdb暂未支持的数据类型~~|  
|  
|
|DTYPE_RAW|支持|支持|SQL> declare    
  2 a raw(200) := '11';    
  3 begin    
  4 insert into t3@test_dblink values(a);    
  5 end;    
  6 /,PL/SQL 过程已成功完成。|
|DTYPE_BLOB|不支持|不支持|  
  SQL> declare    
  2 a blob := hextoraw('1');    
  3 begin    
  4 insert into t3@test_dblink values(a);    
  5 end;    
  6 /    
  declare    
  *    
  第 1 行出现错误:    
  ORA-65503: 无法通过数据库链接发送或接收临时 LOB 定位符    
  ORA-02063: 紧接着 line (起自 TEST_DBLINK)    
  ORA-06512: 在 line 4|
|~~上述未提及的数据类型~~|~~不支持~~|  
|  
|


  


  


  [4. Limitations（功能限制）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#4-limitations%E5%8A%9F%E8%83%BD%E9%99%90%E5%88%B6)  

1.多表insert不支持

2.insert + select不支持

3.insert + on duplicate key 不支持

4. insert + return 不支持（对齐oracle）

5.dblink事务该版本不支持savepoint xx; rollback to xx; 功能，在有dblink场景，使用savepoint, rollback to的时候，对于dblink等同执行rollback，回滚当前dblink的事务。

##   [5. Detail Design（详细设计）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#5-detail-design%E8%AF%A6%E7%BB%86%E8%AE%BE%E8%AE%A1)  

###   [5.1 Architecture（架构）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#51-architecture%E6%9E%B6%E6%9E%84)  

执行阶段：

1. yasdb将从客户端收到的dblink insert 原始sql改写从绑定参数形式，如 insert into t1@test_dblink values(1, 'ee'); 改写成insert into t1 values(:1, :2)并构造好绑定参数写入协议包发送给yex_server进程。
1. yex_server进程收到后，解析CsPacket->head->cmd, 对于insert操作，为DBLINK_CMD_EXECUTE_SQL，然后主要是调用ODBC相关接口，如OCIStmtPrepare2， OCIStmtExecute，发送到oracle执行，并将结果返回给yasdb。


      3.yasdb收到yex_server发送的ack包，根据ack->head→result将结果返回给客户端

事务：

对远端表DML过程中不会出现，正在dml的时候，远端表会ddl的情况，处在事务中，远端数据库oracle会阻止这种行为，报错如下：

SQL> drop table t3;    
  drop table t3    
  *    
  第 1 行出现错误:    
  ORA-00054: 资源正忙, 但指定以 NOWAIT 方式获取资源, 或者超时失效

本地数据库执行commit或者rollback， 会将处于事务内的本地数据库事务和dblink事务全部提交或者全部回滚。

**备注：**  insert的values是在yasdb本地执行出结果再通过绑定参数形式发送到oracle，所以values中有函数形式，如果是yasdb不支持的函数，会报错，这点与update和delete有所不同，update和delete是把完整语句发送到oracle执行，所以这种情况不会在yasdb拦截报错。

###   [5.2 Data Structures & Flow（数据结构与流程）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#52-data-structures--flow%E6%95%B0%E6%8D%AE%E7%BB%93%E6%9E%84%E4%B8%8E%E6%B5%81%E7%A8%8B)  

yasdb：

CodResult verifyDblinkInsert(AnlVerifier* vrfr, InsertContext* context);

static CodResult execSingleInsertPlan(AnlStmt* stmt, AnlPlan* plan)； // 在单表insert执行中加入dblink单表执行的逻辑，将insert执行语句和绑定参数发送给yex_server

yex_server:

static CodResult exsDblinkExecute(ExsSession* session)

  


##   [6. Testcases（自测用例）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#6-testcases%E8%87%AA%E6%B5%8B%E7%94%A8%E4%BE%8B)  

1.4种已支持的insert语法形式功能用例

2.拦截报错场景

3.insert不同数据类型

4.存储过程使用insert

5. 使用commit和rollback，事务测试用例

  


##   [7. Workload（工作量）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#7-workload%E5%B7%A5%E4%BD%9C%E9%87%8F)  

*评估代码量KLOC、工作量（人天）。*

##   [8. TODO（遗留问题）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#8-todo%E9%81%97%E7%95%99%E9%97%AE%E9%A2%98)  

*说明本方案遗留的问题或下一步需要解决的问题。*