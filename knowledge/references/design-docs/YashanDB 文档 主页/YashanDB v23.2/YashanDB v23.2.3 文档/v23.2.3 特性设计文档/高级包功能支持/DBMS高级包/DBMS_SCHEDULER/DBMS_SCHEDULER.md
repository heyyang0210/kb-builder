Created by 张鹏飞, last modified by  曾思尹 on 二月 02, 2024

##   [1. Overview（概述）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#1-overview%E6%A6%82%E8%BF%B0)  

对标Oracle DBMS_SCHEDULER高级包，用于管理定时任务。

DBMS_SCHEDULER中与JOB相关的概念包括

1） PROGRAM 定义要执行的动作

2）SCHEDULER 定义时间表

3）SCHUELER_JOB 定义某个动作按某个时间表执行

相对于DBMS_JOB包，DBMS_SCHEDULER包的功能更为灵活和丰富。例如，某公司有以下定时任务。每周日做本周的考勤数据汇总，每月1日发上个月工资，每月1日汇总上月考勤数据，每周日发放本周午餐补助

用DBMS_JOB包，需要创建4个job，分别执行这四项任务

用DBMS_SCHEDULER_JOB包，可以创建三个PROGRAM，分别为汇总考勤数据，发工资、发午餐补助，创建两个SCHEDULER，分别为每周日执行和每月1日执行。

然后用这些PROGRAM和SCHEDULER组合生成对应的定时任务。

  


  


##   [2. Features（功能特性）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#2-features%E5%8A%9F%E8%83%BD%E7%89%B9%E6%80%A7)  

### 2.1 子过程

#### 2.1.1 CREATE_JOB

CREATE_JOB用于创建一个新的Job

DBMS_SCHEDULER.CREATE_JOB (    
          job_name                            IN                    VARCHAR,    
          job_type                              IN                    VARCHAR,    
          job_action                           IN                    VARCHAR ,    
         number_of_arguments         IN                   INTEGER       DEFAULT 0,    
         start_date                             IN                   TIMESTAMP  DEFAULT NULL,    
         repeat_interval                     IN                   VARCHAR      DEFAULT NULL,    
         end_date                              IN                   TIMESTAMP   DEFAULT NULL,    
         job_class                              IN                    VARCHAR     DEFAULT 'DEFAULT_JOB_CLASS',    
         enabled                               IN                    BOOLEAN      DEFAULT FALSE,    
         auto_drop                           IN                     BOOLEAN      DEFAULT TRUE,    
         comments                           IN                     VARCHAR      DEFAULT NULL);

|参数|用途|
|:---|:---|
|job_name|Job名称，可以为schema.job_name格式，不能与schema下的表、存储过程等重名|
|job_type|job_action的类型，当前只支持PLSQL_BLOCK和STORED_PROCEDURE|
|job_action|该Job要执行的PL/SQL文本。可以是匿名块或者存储过程。需要以分号结束, 并且应当与job_type匹配|
|number_of_arguments         |Job运行时需要的参数的个数，当前不支持传参，因此该参数暂不生效|
|start_date                             |Job开始执行的时间|
|repeat_interval|一个表达式文本，用于计算Job下次执行的时间。如果为NULL，则Job只执行一次。通过表达式计算出的时间必须为将来时间或者NULL|
|end_date|Job执行结束的时间，超过该时间后，job将不再自动执行|
|job_class|该Job所属的分类，默认为DEFAULT_JOB_CLASS，用户自定义Job分类暂不支持|
|enabled|Job是否生效，默认为false，不生效。只有生效的Job才会自动执行|
|auto_drop|指定当Job完成后是否自动删除。,当Job满足以下条件之一时，会被标记为完成：,1 当前时间已超过Job的end_date,2 用户设置了Job的最大执行次数，并且Job自动执行的次数已达到最大执行次数,3 Job不重复执行（未设置repeat_interval)，并且已执行了一次（不包括通过调用RUN_JOB手动执行的，该情况不计RUN_COUNT）。|
|comments|用户为Job添加的描述信息，默认为NULL|


  


#### 2.1.2 DROP_JOB

DROP_JOB用于删除一个Job,当前仅Job_name参数生效

DBMS_SCHEDULER.DROP_JOB (    
          job_name                            IN                    VARCHAR，

        force                                   IN                   BOOL,

        defer                                   IN                    BOOL,

         commit_semantics            IN                     VARCHAR

  );

|参数|用途|
|:---|:---|
|job_name|Job名称，可以为schema.job_name格式|
|force|暂不生效|
|defer|暂不生效|
|commit_semantics|暂不生效|


  


#### 2.1.3 ENABLE

ENABLE用于使一个JOB生效

DBMS_SCHEDULER.ENABLE(    
          job_name                            IN                    VARCHAR);

|参数|用途|
|:---|:---|
|job_name|Job名称，可以为schema.job_name格式|


  


#### 2.1.4 DISABLE

DISABLE用于使一个JOB失效

DBMS_SCHEDULER.DISABLE(    
          job_name                            IN                    VARCHAR);

|参数|用途|
|:---|:---|
|job_name|Job名称，可以为schema.job_name格式|


  


#### 2.1.5 SET_ATTRIBUTE

SET_ATTRIBUTE设置Job的属性

DBMS_SCHEDULER.SET_ATTRIBUTE(    
          job_name                            IN                    VARCHAR，

        attribute                              IN                    VARCHAR,

        value                                   IN                    {BOOLEAN|DATE|TIMESTAMP| TIMESTAMP WITH TIME ZONE|TIMESTAMP WITH LOCAL TIME ZONE| INTERVAL DAY TO SECOND} );

|参数|用途|
|:---|:---|
|job_name|Job名称，可以为schema.job_name格式|
|attribute|要修改的属性名称，当前支持对以下属性做修改：,auto_drop,comments,end_date,job_action,repeat_interval,start_date|
|value|要修改的属性值|


### 2.2 系统视图

#### 2.2.1 DBA_SCHEDULER_JOBS

|列|数据类型|NULL|描述|
|:---|:---|:---|:---|
|  `OWNER`  |  `VARCHAR(64)`  |  
|Job的所有者|
|  `JOB_NAME`  |  `VARCHAR(64)`  |  
|Job名称|
|  `JOB_SUBNAME`  |  `VARCHAR(64)`  |  
|Job Chain的子名称，暂不支持|
|  `JOB_STYLE`  |  `CHAR(6)`  |  
|Job style:暂时只支持    `REGULAR`  |
|  `JOB_CREATOR`  |  `VARCHAR(64)`  |  
|创建Job的用户名|
|  `CLIENT_ID`  |  `VARCHAR(64)`  |  
|创建Job的客户端标识，暂不支持|
|  `PROGRAM_OWNER`  |  `VARCHAR(4000)`  |  
|该Job所关联的Program的所有者，暂不支持|
|  `PROGRAM_NAME`  |  `VARCHAR(4000)`  |  
|该Job所关联的Program的名称，暂不支持|
|  `JOB_TYPE`  |  `CHAR(16)`  |  
|job action 的类型:,-   `PLSQL_BLOCK`  
-   `STORED_PROCEDURE`  
|
|  `JOB_ACTION`  |  `VARCHAR(4000)`  |  
|job执行的动作|
|  `NUMBER_OF_ARGUMENTS`  |BINARY_INTEGER|  
|Job的参数个数|
|  `SCHEDULE_OWNER`  |  `VARCHAR(4000)`  |  
|Job使用的Schedule所有者，暂不支持|
|  `SCHEDULE_NAME`  |  `VARCHAR2(4000)`  |  
|Job使用的Schedule名称，暂不支持|
|  `SCHEDULE_TYPE`  |  `CHAR(5)`  |  
|Job使用的Schedule类型,-   `PLSQL`  
|
|  `START_DATE`  |  `TIMESTAMP`  |  
|Job开始执行的时间|
|  `REPEAT_INTERVAL`  |  `VARCHAR(4000)`  |  
|Job执行的时间间隔|
|  `END_DATE`  |  `TIMESTAMP`  |  
|Job结束执行的时间|
|  `ENABLED`  |  `VARCHAR(5)`  |  
|Job是否生效|
|  `AUTO_DROP`  |  `VARCHAR(5)`  |  
|Job完成后是否自动删除|
|  `STATE`  |  `VARCHAR2(20)`  |  
|Job当前的状态，目前支持以下几种状态:,-   `DISABLED`  
-   `SCHEDULED`  
-   `RUNNING`  
-   `COMPLETED`  
|
|  `RUN_COUNT`  |  `NUMBER`  |  
|Job已经执行的次数|
|  `MAX_RUNS`  |  `NUMBER`  |  
|Job最大执行的次数|
|  `FAILURE_COUNT`  |  `NUMBER`  |  
|Job失败的次数|
|  `MAX_FAILURES`  |  `NUMBER`  |  
|Job允许失败的次数，失败次数超过该值后，Job将被标记为失效|
|  `RETRY_COUNT`  |  `NUMBER`  |  
|Job失败后重试的次数|
|  `LAST_START_DATE`  |  `TIMESTAMP`  |  
|Job最后一次开始执行的时间|
|  `LAST_RUN_DURATION`  |  `INTERVAL DAY(9) TO SECOND(6)`  |  
|Job最后一次执行持续的时间（单位:秒）|
|  `NEXT_RUN_DATE`  |  `TIMESTAMP`  |  
|Job下次执行的时间|
|  `COMMENTS`  |  `VARCHAR(4000)`  |  
|用户为Job添加的描述信息|


#### 2.2.2 USER_SCHEDULER_JOBS

|列|数据类型|NULL|描述|
|:---|:---|:---|:---|
|  `JOB_NAME`  |  `VARCHAR(64)`  |  
|Job名称|
|  `JOB_SUBNAME`  |  `VARCHAR(64)`  |  
|Job Chain的子名称，暂不支持|
|  `JOB_STYLE`  |  `CHAR(6)`  |  
|Job style:暂时只支持    `REGULAR`  |
|  `JOB_CREATOR`  |  `VARCHAR(64)`  |  
|创建Job的用户名|
|  `CLIENT_ID`  |  `VARCHAR(64)`  |  
|创建Job的客户端标识，暂不支持|
|  `PROGRAM_OWNER`  |  `VARCHAR(4000)`  |  
|该Job所关联的Program的所有者，暂不支持|
|  `PROGRAM_NAME`  |  `VARCHAR(4000)`  |  
|该Job所关联的Program的名称，暂不支持|
|  `JOB_TYPE`  |  `CHAR(16)`  |  
|job action 的类型:,-   `PLSQL_BLOCK`  
-   `STORED_PROCEDURE`  
|
|  `JOB_ACTION`  |  `VARCHAR(4000)`  |  
|job执行的动作|
|  `NUMBER_OF_ARGUMENTS`  |BINARY_INTEGER|  
|Job的参数个数|
|  `SCHEDULE_OWNER`  |  `VARCHAR(4000)`  |  
|Job使用的Schedule所有者，暂不支持|
|  `SCHEDULE_NAME`  |  `VARCHAR2(4000)`  |  
|Job使用的Schedule名称，暂不支持|
|  `SCHEDULE_TYPE`  |  `CHAR(5)`  |  
|Job使用的Schedule类型,-   `PLSQL`  
|
|  `START_DATE`  |  `TIMESTAMP`  |  
|Job开始执行的时间|
|  `REPEAT_INTERVAL`  |  `VARCHAR(4000)`  |  
|Job执行的时间间隔|
|  `END_DATE`  |  `TIMESTAMP`  |  
|Job结束执行的时间|
|  `ENABLED`  |  `VARCHAR(5)`  |  
|Job是否生效|
|  `AUTO_DROP`  |  `VARCHAR(5)`  |  
|Job完成后是否自动删除|
|  `STATE`  |  `VARCHAR2(20)`  |  
|Job当前的状态，目前支持以下几种状态:,-   `DISABLED`  
-   `SCHEDULED`  
-   `RUNNING`  
-   `COMPLETED`  
|
|  `RUN_COUNT`  |  `NUMBER`  |  
|Job已经执行的次数|
|  `MAX_RUNS`  |  `NUMBER`  |  
|Job最大执行的次数|
|  `FAILURE_COUNT`  |  `NUMBER`  |  
|Job失败的次数|
|  `MAX_FAILURES`  |  `NUMBER`  |  
|Job允许失败的次数，失败次数超过该值后，Job将被标记为失效|
|  `RETRY_COUNT`  |  `NUMBER`  |  
|Job失败后重试的次数|
|  `LAST_START_DATE`  |  `TIMESTAMP`  |  
|Job最后一次开始执行的时间|
|  `LAST_RUN_DURATION`  |  `INTERVAL DAY(9) TO SECOND(6)`  |  
|Job最后一次执行持续的时间（单位:秒）|
|  `NEXT_RUN_DATE`  |  `TIMESTAMP`  |  
|Job下次执行的时间|
|  `COMMENTS`  |  `VARCHAR(4000)`  |  
|用户为Job添加的描述信息|


#### 2.2.3 ALL_SCHEDULER_JOBS

同DBA_SCHEDULER_JOBS

##   [3. Interfaces（接口）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#3-interfaces%E6%8E%A5%E5%8F%A3)  

*列出本方案对外提供的接口、配置参数、API等。*

SQL提供功能。

##   [4. Limitations（功能限制）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#4-limitations%E5%8A%9F%E8%83%BD%E9%99%90%E5%88%B6)  

1、目前没有实现类似Oracle的日历机制，当前与dbms_job使用一套规格

2、当前不支持创建scheduler，通过scheduler调度不同的job模式，当前仅支持于dbms_job类似的一条语句创建job(inline job)

3、系统视图中部分字段未生效

4、Job_name长度不能超过64

5、action暂时只支持输入相关SQL，不支持系统命令、脚本等

  


  


##   [5. Detail Design（详细设计）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#5-detail-design%E8%AF%A6%E7%BB%86%E8%AE%BE%E8%AE%A1)  

*方案设计的详细说明，包括但不限于方案选型、方案所依赖的技术/第三方组件的原理或背景介绍、关键技术点、方案折衷的考量、可靠性分析、兼容性分析。可以根据需要增删小节。*

  


##   [6. Testcases（自测用例）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#6-testcases%E8%87%AA%E6%B5%8B%E7%94%A8%E4%BE%8B)  

*设计开发人员自测用例（文字描述）。*

自测关注点：

1. 覆盖全面
1. 避免重复测试
1. 测试用例的可维护性


自测用例设计方法：

1. 边界值
1. 等价类
1. 正交


test\regresstest\sql\dbms_job.sql

##   [7. Document（资料）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#7-document%E8%B5%84%E6%96%99)  

  


  


##   [8. Workload（工作量）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#8-workload%E5%B7%A5%E4%BD%9C%E9%87%8F)  

*评估代码量KLOC、工作量（人天）。*

##   [9. TODO（遗留问题）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#9-todo%E9%81%97%E7%95%99%E9%97%AE%E9%A2%98)  

*说明本方案遗留的问题或下一步需要解决的问题。*

## Attachments:

[image2022-4-19_18-46-19.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkOGRhMWFkOWEzMzExZGM5MjBjIiwicmVmX2lkIjoiNjczOTZkOGQ1OTNmOTljOWZmMjM3Y2I1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA5MjgyLCJleHAiOjE3ODIzOTU2ODJ9.w9ubwA3CrV0VfHBXHH268dPa_Y6HkNkT8oSiL-vD3AI)

 (image/png)    


[alter trigger.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkOGU4OTcwYzJhZjRmNTIxMzlhIiwicmVmX2lkIjoiNjczOTZkOGQ1OTNmOTljOWZmMjM3Y2I1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA5MjgyLCJleHAiOjE3ODIzOTU2ODJ9.qLmdBM3LpgAM1ayvLKLSa3VT9mpPIvPKTNcf0NzLreI)

 (image/png)    


[image2022-4-19_18-46-38.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkOGVhMWFkOWEzMzExZGM5MjBkIiwicmVmX2lkIjoiNjczOTZkOGQ1OTNmOTljOWZmMjM3Y2I1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA5MjgyLCJleHAiOjE3ODIzOTU2ODJ9.tmxN3_7soHvzogj1HAc0bYSZHcEOWE2rAHxvQI3TmVs)

 (image/png)    


[image2022-4-12_17-50-1.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkOGVhMWFkOWEzMzExZGM5MjBlIiwicmVmX2lkIjoiNjczOTZkOGQ1OTNmOTljOWZmMjM3Y2I1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA5MjgyLCJleHAiOjE3ODIzOTU2ODJ9.17H7NnvHMkcGW9eeB_AbdRFhQkq6JjPgsxqbeoL9-QA)

 (image/png)    


[image2022-4-12_17-48-27.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkOGU4OTcwYzJhZjRmNTIxMzliIiwicmVmX2lkIjoiNjczOTZkOGQ1OTNmOTljOWZmMjM3Y2I1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA5MjgyLCJleHAiOjE3ODIzOTU2ODJ9.AVVVlmacoHbH7pI7jwXqygi8C_nQMuR8p6vlxSRJ6tU)

 (image/png)    
