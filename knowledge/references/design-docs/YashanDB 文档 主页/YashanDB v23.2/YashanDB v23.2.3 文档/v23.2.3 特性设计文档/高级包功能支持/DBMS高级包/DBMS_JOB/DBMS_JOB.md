Created by 张鹏飞, last modified by  未知用户 (wangyibo) on 七月 06, 2022

##   [1. Overview（概述）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#1-overview%E6%A6%82%E8%BF%B0)  

对标ORACLE DBMS_JOB包。

DBMS_JOB包提供了一组内置的存储过程，用于创建、执行、修改、删除定时任务。

Job主要包含三个要素：

1）唯一标识 创建Job的时候生成，唯一标识一个Job

2)  Job需要执行的任务

3）Job执行时间及频率

##   [2. Features（功能特性）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#2-features%E5%8A%9F%E8%83%BD%E7%89%B9%E6%80%A7)  

### 2.1 子过程

#### 2.1.1 SUBMIT

SUBMIT用于创建一个新的Job, commit生效

DBMS_JOB.SUBMIT (

            job            OUT        BINARY_BIGINT,

            what             IN        VARCHAR,

           next_date      IN        DATE DEFAULT SYSDATE,

           interval          IN        VARCHAR DEFAULT 'null',

           no_parse        IN        BOOLEAN DEFAULT FALSE,

           instance         IN        BINARY_INTEGER DEFAULT  any_instance,

           force              IN        BOOLEAN DEFAULT FALSE);

|参数|用途|
|---|---|
|job|系统为Job分配的对象ID，Bigint类型或可以转换为bigInt类型的值（boolean除外），不可以为NULL或非匿名块变量，可以通过DBA_JOBS、USER_JOBS查询|
|what|该Job要执行的PL/SQL文本。可以是匿名块或者存储过程。需要以分号结束，且不可以是NULL|
|next_date|指定Job下次执行的时间|
|interval|一个表达式文本，用于计算Job下次执行的时间。如果为NULL，则Job只执行一次。通过表达式计算出的时间必须为将来时间或者NULL|
|no_parse|标识在创建Job时，是否需要解析what指定的PL/SQL文本|
|instance|仅用于集群，暂不生效|
|force|仅用于集群，暂不生效|


#### 2.1.2 REMOVE

REMOVE用于删除一个非执行状态下的JOB, commit生效，job_id不存在时报错

DBMS_JOB.REMOVE(

            job            IN        BINARY_BIGINT);

|参数|用途|
|---|---|
|job|系统为Job分配的对象ID，Bigint类型，可以通过DBA_JOBS、USER_JOBS查询|


#### 2.1.3 BROKEN

BROKEN更改非执行状态下的JOB的有效性，失效后的JOB将不再被后台自动执行, commit生效

DBMS_JOB.REMOVE(

            job            IN          BINARY_BIGINT,

            broken      IN          BOOLEAN,

            next_date  IN          DATE DEFAULT SYSDATE);

|参数|用途|
|---|---|
|job|系统为Job分配的对象ID，Bigint类型，可以通过DBA_JOBS、USER_JOBS查询|
|broken|是否失效|
|next_date|JOB下次执行的时间|


#### 2.1.4 CHANGE

修改JOB的属性, commit生效

DBMS_JOB.CHANGE(

            job            IN          BINARY_BIGINT,

            what         IN          VARCHAR,

            next_date  IN          DATE,

            interval      IN          VARCHAR,

            instance     IN          BINARY_INTEGER DEFAULT NULL,

            force          IN          BOOLEAN DEFAULT FALSE);

|参数|用途|
|---|---|
|job|系统为Job分配的对象ID，Bigint类型，可以通过DBA_JOBS、USER_JOBS查询|
|what         |该Job要执行的PL/SQL文本。可以是匿名块或者存储过程。需要以分号结束|
|next_date|JOB下次执行的时间|
|interval|一个表达式文本，用于计算Job下次执行的时间。如果为NULL，则Job只执行一次。通过表达式计算出的时间必须为将来时间或者NULL|
|instance|用于集群环境，暂不生效|
|force|用于集群环境，暂不生效|


#### 2.1.5 NEXT_DATE

修改JOB下次执行的时间, commit生效

DBMS_JOB.NEXT_DATE(

            job            IN          BINARY_BIGINT,

            next_date  IN          DATE);

|参数|用途|
|---|---|
|job|系统为Job分配的对象ID，Bigint类型，可以通过DBA_JOBS、USER_JOBS查询|
|next_date|JOB下次执行的时间|


#### 2.1.6 INTERVAL

修改JOB执行的频率, commit生效

DBMS_JOB.INTERVAL(

            job            IN          BINARY_BIGINT,

            instance     IN          BINARY_INTEGER DEFAULT NULL);

|参数|用途|
|---|---|
|job|系统为Job分配的对象ID，Bigint类型，可以通过DBA_JOBS、USER_JOBS查询|
|interval|一个表达式文本，用于计算Job下次执行的时间。如果为NULL，则Job只执行一次。通过表达式计算出的时间必须为将来时间或者NULL|


#### 2.1.7 WHAT

修改JOB的动作, commit生效

DBMS_JOB.WHAT(

            job            IN          BINARY_BIGINT,

            what         IN          VARCHAR);

|参数|用途|
|---|---|
|job|系统为Job分配的对象ID，Bigint类型，可以通过DBA_JOBS、USER_JOBS查询|
|what         |该Job要执行的PL/SQL文本。可以是匿名块或者存储过程。需要以分号结束|


#### 2.1.8 RUN

手动执行JOB, commit生效

DBMS_JOB.RUN(

            job            IN          BINARY_BIGINT,

            force          IN          BOOLEAN DEFAULT FALSE);

|参数|用途|
|---|---|
|job|系统为Job分配的对象ID，Bigint类型，可以通过DBA_JOBS、USER_JOBS查询|
|force|用于集群环境，暂不生效|


### 2.2 系统视图

#### 2.2.1 DBA_JOBS

|列|数据类型|NULL|描述|
|:---|:---|:---|:---|
|  `JOB`  |  `BINARY_BIGINT`  |  `NOT NULL`  |Job的ID，由系统自动分配，与DBA_OBJECTS中的OBJECT_ID相同|
|  `LOG_USER`  |  `VARCHAR（64）`  |  `NOT NULL`  |创建JOB时登录的用户|
|  `PRIV_USER`  |  `VARCHAR(64)`  |  `NOT NULL`  |赋予Job权限的用户|
|  `SCHEMA_USER`  |  `VARCHAR(64)`  |  `NOT NULL`  |Job所有者的用户名|
|  `LAST_DATE`  |  `TIMESTAMP`  |  
|Job上一次执行的时间。|
|  `LAST_SEC`  |  `VARCHAR(64)`  |  
|同     `LAST_DATE`  |
|  `THIS_DATE`  |  `TIMESTAMP`  |  
|如果Job正在执行，则为本次开始执行的时间。通常为NULL。|
|  `THIS_SEC`  |  `VARCHAR(64)`  |  
|同THIS_DATE|
|  `NEXT_DATE`  |  `TIMESTAMP`  |  
|Job下次执行的时间|
|  `NEXT_SEC`  |  `VARCHAR(64)`  |  
|同NEXT_DATE|
|  `TOTAL_TIME`  |BINARY_INTEGER|  
|最后一次执行持续的时间（单位:秒）|
|  `BROKEN`  |CHAR(1)|  
|  `Y`    : 将不再自动执行该Job,  `N`    : 可能自动执行该Job|
|  `INTERVAL`  |  `VARCHAR(4000)`  |  
|用于计算NEXT_DATE的表达式|
|  `FAILURES`  |BINARY_INTEGER|  
|最后一次成功执行后，失败的次数|
|  `WHAT`  |  `VARCHAR(4000)`  |  
|Job执行的动作|
|  `INSTANCE`  |BINARY_INTEGER|  
|执行Job的实例ID(暂不生效)|


#### 2.2.2 USER_JOBS

同DBA_JOBS

#### 2.2.3 ALL_JOBS

同DBA_JOBS

### 2.3 参数

JOB_QUEUE_PROCESSES

指定后台自动执行Job的线程数，允许的范围【0-1000】，默认16.

1）当JOB_QUEUE_PROCESSES = 0时，所有Job不会被后台自动执行

2）某一时间需要自动执行Job数量大于当前空闲的Job线程数时，Job需要排队等待

3）该参数需要重启生效

  


  [3. Interfaces（接口）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#3-interfaces%E6%8E%A5%E5%8F%A3)  

*列出本方案对外提供的接口、配置参数、API等。*

SQL提供功能。

##   [4. Limitations（功能限制）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#4-limitations%E5%8A%9F%E8%83%BD%E9%99%90%E5%88%B6)  

1 what和interval的长度不得超过4000字节

2 同一个Job执行的时间间隔不小于1秒

##   [5. Detail Design（详细设计）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#5-detail-design%E8%AF%A6%E7%BB%86%E8%AE%BE%E8%AE%A1)  

*方案设计的详细说明，包括但不限于方案选型、方案所依赖的技术/第三方组件的原理或背景介绍、关键技术点、方案折衷的考量、可靠性分析、兼容性分析。可以根据需要增删小节。*

  [6. Testcases（自测用例）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#6-testcases%E8%87%AA%E6%B5%8B%E7%94%A8%E4%BE%8B)  

*设计开发人员自测用例（文字描述）。*

自测关注点：

1. 覆盖全面
1. 避免重复测试
1. 测试用例的可维护性


自测用例设计方法：

1. 边界值
1. 等价类
1. 正交


test\regresstest\sql\trigger.sql

##   [7. Document（资料）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#7-document%E8%B5%84%E6%96%99)  

  


  [https://docs.oracle.com/en/database/oracle/oracle-database/21/arpls/DBMS_JOB.html#GUID-53854090-97F8-43CD-91CA-8ADCEBA6E2E8](https://docs.oracle.com/en/database/oracle/oracle-database/21/arpls/DBMS_JOB.html#GUID-53854090-97F8-43CD-91CA-8ADCEBA6E2E8)  

##   [8. Workload（工作量）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#8-workload%E5%B7%A5%E4%BD%9C%E9%87%8F)  

*评估代码量KLOC、工作量（人天）。*

##   [9. TODO（遗留问题）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#9-todo%E9%81%97%E7%95%99%E9%97%AE%E9%A2%98)  

*说明本方案遗留的问题或下一步需要解决的问题。*

## Attachments:



 (image/png)    




 (image/png)    




 (image/png)    




 (image/png)    




 (image/png)    
