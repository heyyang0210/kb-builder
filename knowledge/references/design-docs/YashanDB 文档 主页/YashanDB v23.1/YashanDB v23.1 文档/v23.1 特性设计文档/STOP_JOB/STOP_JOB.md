Created by 郝鑫刚, last modified on 七月 31, 2023

##   [YDBRD-16501](https://jira.yasdb.com/browse/YDBRD-16501?src=confmacro)    -  支持DBMS_SCHEDULER.STOP_JOB  完成

  


##   [1. Overview（概述）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#1-overview%E6%A6%82%E8%BF%B0)  

DBMS_SCHEDULER.STOP_JOB（）接口用于主动停止正在运行的JOB。

  


##   [2. Features（功能特性）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#2-features%E5%8A%9F%E8%83%BD%E7%89%B9%E6%80%A7)  

  


```
DBMS_SCHEDULER.STOP_JOB (
    job_name IN VARCHAR2
    force IN BOOLEAN DEFAULT FALSE
    commit_semantics IN VARCHAR2 DEFAULT 'STOP_ON_FIRST_ERROR');
```

job_name： 一个或多个定时任务的名称，多个时用逗号分隔。

force：   语法兼容，无实际含义。 

commit_semantics ：语法兼容，无实际含义。

  


集群中的job

需要在正在执行job的实例上执行STOP_JOB。

  


ORACLE:

ALL_SCHEDULER_JOB_RUN_DETAILS.INSTANCE_ID  Identifier of the instance on which the job was run

##   [3. Interfaces（接口）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#3-interfaces%E6%8E%A5%E5%8F%A3)  

SQL中通过DBMS_SCHEDULER.STOP_JOB执行。

  


##   [4. Limitations（功能限制）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#4-limitations%E5%8A%9F%E8%83%BD%E9%99%90%E5%88%B6)  

  


oracle上force说明有权限和终止方式区别，yasdb没有区别。

##   [5. Detail Design（详细设计）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#5-detail-design%E8%AF%A6%E7%BB%86%E8%AE%BE%E8%AE%A1)  

  


STOP_JOB：

1. 解析job_name 组成list
1. 获取jobId，获取job状态，不存在或未运行时报错。
1. 找到job对于的ctx，标记CTRL-C信号。
1. 等待所有job停止。


在第二步中是按顺序进行的，所以如果中间的job报错时，该job之前的已标记STOP了，该job之后的未标记STOP。

  


集群：

job执行时在SCHEDULER$_JOB.RUNNING_INSTANCE更新正在运行的实例id。

DBA_SCHEDULER_JOBS中增加字段RUNNING_INSTANCE显示正在执行JOB的实例ID。

操作：查询DBA_SCHEDULER_JOBS.RUNNING_INSTANCE后在对应实例上执行STOP_JOB。

##   [6. Testcases（自测用例）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#6-testcases%E8%87%AA%E6%B5%8B%E7%94%A8%E4%BE%8B)  

  


  


  


  
