Created by 瞿蓝孟, last modified on 一月 03, 2024

SR：    [YDBRD-22621](https://jira.yasdb.com/browse/YDBRD-22621?src=confmacro)    -  OM支持自动收集分布式统计信息  完成

##   [1. 总述](#1-总述)  

om要实现定时在db的节点上执行sql的能力，具体执行收集统计信息的sql依赖db自身的功能；

###   [1.1 需求来源](#11-需求来源)  

根据分布式的要求，由于分布式自身的job能力尚未实现，分布式没有定时执行任务的能力，所以需要借助om的能力来完成定时执行sql的能力。考虑到单机lsc也有类似的述求，故设计中也考虑单机的情况，只对共享集群做拦截。

- 支持单机
- 支持分布式


###   [1.2 调研文档](#12-调研文档)  

无

###   [1.3 需求分析](#13-需求分析)  

利用om的定时模块，定时执行sql

###   [1.4 数据字典](#14-数据字典)  

无

###   [1.5 开源依赖](#15-开源依赖)  

无

##   [2. 接口](#2-接口)  

- **yasboot新增命令行接口**
    - job子命令


|命令|说明|
|---|---|
|job config gen|生成job配置文件|
|job add|新增job|
|job apply|应用job到db|
|job cancel|取消应用job|
|job delete|删除job|
|job update|更新job|
|job  list|展示job列表|
|job show|展示job详细信息|
|job execute|立即执行一次job|


##   [3. 规格与约束](#3-规格与约束)  

- 应用对象
    - 分布式;
    - 单机；


##   [4. 特性](#4-特性)  

###   [4.1 特性设计](#41-特性设计)  

om在做备份恢复功能时，已经实现了定时任务的模块，这里直接利用已有定时能力，去执行统计信息相关的任务；

om的定时模块的架构如下：

![](https://pingcode.yasdb.com/atlas/files/public/67396c208970c2af4f520968/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFDQUFBQUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFBQUFFQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBZ0FBQUFBQUFCQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUFBRUFCQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFRQUFBQUFBQUFBQUFBQUFBQUJBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTkxNzMsImV4cCI6MTc4MjMwOTk3M30.kAh3MBnXzx3zNq-wFyX6AtK7fLj5SIXqyybAA3KhBLU)

整体的架构如上图，主要新增部分如下：

- 在yasboot中新增  **job**  命令，用于下发定时任务的指令；
- cron模块是yasom已实现的模块。基于job策略，cron模块周期性下发具体的任务到task模块中，task下发具体任务到db；


整体流程：

![](https://pingcode.yasdb.com/atlas/files/public/67396c20a1ad9a3311dc87d6/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFDQUFBQUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFBQUFFQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBZ0FBQUFBQUFCQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUFBRUFCQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFRQUFBQUFBQUFBQUFBQUFBQUJBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTkxNzMsImV4cCI6MTc4MjMwOTk3M30.kAh3MBnXzx3zNq-wFyX6AtK7fLj5SIXqyybAA3KhBLU)

#####   [4.1.1生成job配置文件：](#411生成job配置文件)  

**命令**  ：    `job config gen`  

**参数**  ：

- **--cluster，-c**  ：集群名称，必填项
- **--job-name**  ：job名称，必填项
- **--user, -u**  ：执行任务的db的用户名
- **--password, -p**  ：执行任务的db的密码
- **--sql**  ：执行的sql语句，与--sql-file互斥
- **--sql-file**  : 执行的sql文件，与--sql互斥
- **--cron-expression, -ce**  ：    `cron`    表达式 (设置了该参数，下面三个参数失效)
- **--frequency，-f**  ：执行频率，默认为    `daily`    ，可选值如下：
    -   `monthly`    ：每月
    -   `weekly`    ：每周
    -   `daily`    ：每天
    -   `hourly`    ：每小时
- **--days，-d**  ：具体某天，表示每月或者每周的第几天，可填写多天 。 eg:     `1,5,6,7`    和    `1，5-7`    都表示第1、5、6和7天；
    - 只有在    `monthly`    、    `weekly`    才参数有效
    - 当频率为    `monthly`    ，取值范围为    `1~31`  
    - 当频率为    `weekly`    ，取值范围为    `1-7`    ，表示星期一到星期天
- **--start-time，-st**  ：策略开始时间
    - 当频率为    `monthly`    、    `weekly`    和    `daily`    ，格式为    `**:**`    ，表示小时和分钟；默认为    `00:00`  
    - 当频率为    `hourly`    ，格式为    `**`    ，表示分钟；默认为    `0`  
- **--config-path**  ：配置文件输出地址，默认为    `当前地址`  


策略配置文件：    `job_yashandb_test01.toml`  

```
cluster = "yashandb"
job_name = "test01"
username = "dba"
passowrd = "xxx"
sql = "select * from v$instance" //sql和sql_file只能有一个
sql_file = /opt/test.sql

[timeConfig]
  # CronExpression = "1 1 * * *"
  frequency = "WEEKLY"                // 每周进行 
  days = [1, 2, 3]                    // 每周的星期一、星期二和星期三
  StartTime = "00:00"                 // 每天12:10开始



```

####   [4.1.2  新增job](#412--新增job)  

**命令**  ：    `job add`  

**参数**  ：

- **--toml，-t**  ：crontab策略配置文件，必填项


备注：解析toml配置文件中的策略，并将其存贮到sqlite3数据库中

####   [4.1.3 应用job](#413-应用job)  

**子命令**  ：    `job apply`  

**参数**  ：

- **--cluster，-c**  ：集群名称，必填项
- **--job-id，-j**  ：job id，必填项
- **--node-id，-n**  ：节点id，必填项
    - 单机
    - 分布式：目前统计信息要求必须是cn节点（其他节点也不会报错，om不做拦截）
- **--group-id，-g**  ：节点组id（暂不支持，后续迭代优化支持）


####   [4.1.4 取消job策略](#414-取消job策略)  

**子命令**  ：    `job cancel`  

**参数**  ：

- **--cluster，-c**  ：集群名称，必填项
- **--job-id，-j**  ：job id，必填项
- **--node-id，-n**  ：节点id，必填项


####   [4.1.5 删除job策略](#415-删除job策略)  

**子命令**  ：    `job delete`  

**参数**  ：

- **--cluster，-c**  ：集群名称，必填项
- **--job-id，-j**  ：job id，必填项
- **--force，-f**  ：强制删除，选填项，默认为    `false`  
    - 若策略已经被应用，需要强制才能删除


####   [4.1.6 分页展示job](#416-分页展示job)  

**子命令**  ：    `job list`  

**参数**  ：

- **--cluster，-c**  ：集群名称，必填项
- **--node-id，-n**  ：节点id
- **--detail，-d**  ：详细信息，选填项
- **--size**  ：一页数据量，默认值为10
- **--page，-p**  ：当前分页，默认值为1
- **--sort，S**  ：排序字段，默认为    `created_at`  
- **--order，-o**  ：排序，默认为    `dasc`    ，可选值有：    `dasc`    和    `asc`  
- **--search**  ：通过列搜索；格式为    `rowName:searchValue`  


```
$ ./bin/yasboot job list -c tt
 id | job_id                           | job_name | cron_expression | apply 
----------------------------------------------------------------------------
 1  | 658455b02ae4bd28aaa0a4664c82671d | aa       | * * * * *       | -     
----+----------------------------------+----------+-----------------+-------
$ ./bin/yasboot job list -c tt -d
 id | job_id                           | job_name | cron_expression | apply     | user | sql                       | sql_file 
------------------------------------------------------------------------------------------------------------------------------
 1  | 65854be05633063840eafdf1b8e46cb5 | aa       | * * * * *       | node: 1-1 | sys  | select * from v$instance; | -        
----+----------------------------------+----------+-----------------+-----------+------+---------------------------+----------
   

```

####   [4.1.7 更新job](#417-更新job)  

**子命令**  ：    `job upgrade`  

**参数**  ：

- **--toml，-t**  ：job配置文件，必填项
- **--job-id，-j**  ：job id，必填项


```
$ ./bin/yasboot job upgrade -t job1.toml --jod-id 111

```

####   [4.1.8  立即执行job](#418--立即执行job)  

**命令**  ：    `job execute`  

**参数**  ：

- **--cluster，-c**  ：集群名称，必填项
- **--job-id，-j**  ：job id，必填项


立即执行一次job，不走cron定时模块，job必须已经apply才能使用该命令；

####   [4.1.9 展示job的执行信息](#419-展示job的执行信息)  

**子命令**  ：    `job show`  

**参数**  ：

- **--cluster，-c**  ：集群名称，必填项
- **--job-id，-j**  ：job id，必填项
- **--node-id，-n**  ：节点id，必填项
- **--detail，-d**  ：详细信息，选填项
- **--size**  ：一页数据量，默认值为10
- **--page，-p**  ：当前分页，默认值为1


展示job的执行过程，包括结果（成功/失败）

```
$ ./bin/yasboot job show -c tt -j 6594d0c89b973f7a8f265b81f1027e3e -n 1-1

 id | job_id                           | node_id | status 
----------------------------------------------------------
 2  | 6594d0c89b973f7a8f265b81f1027e3e | 1-1     | finish 
----+----------------------------------+---------+--------


$ ./bin/yasboot job show -c tt -j 6594d0c89b973f7a8f265b81f1027e3e -n 1-1 -d
 id | job_id                           | node_id | status | start_time          | completion_time     | hostid   
-----------------------------------------------------------------------------------------------------------------
 2  | 6594d0c89b973f7a8f265b81f1027e3e | 1-1     | finish | 2024-01-03 11:13:41 | 2024-01-03 11:13:42 | host0001 
----+----------------------------------+---------+--------+---------------------+---------------------+----------



```

######   [](#)  

###   [4.5 特性可维可测设计](#45-特性可维可测设计)  

增加了job execute接口，方便测试直接触发job，不用等待定时时间；

###   [4.6 特性安全设计](#46-特性安全设计)  

无

###   [4.7 特性周边配合](#47-特性周边配合)  

无

##   [5. Testcases（自测用例）](#5-testcases自测用例)  

1. 根据命令生成不同时间的策略，应用到db后，观察日志是否有定时执行sql任务；
1. 根据job


##   [6.资料设计章节](#6资料设计章节)  

- 补充新增命令的介绍资料


##   [7.未来规划](#7未来规划)  

考虑到工作量的问题，目前应用job里面的nodeid参数是必填的，后续考虑优化：

- node-id为选填参数，不填写的情况下，自动去寻找可用的node
- 节点组id，自动寻找组内可用的node


  


## Attachments:

[流程图.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjMjBhMWFkOWEzMzExZGM4N2Q0IiwicmVmX2lkIjoiNjczOTZjMjA1OTNmOTljOWZmMjM2YTlhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk5MTczLCJleHAiOjE3ODIzODU1NzN9.cdatKRL_UkrJL6AQM44zHajfVqAAheGrjAjBYNEAP6o)

 (image/png)    


## Comments:

|  [](null)  ,会议纪要：    [OM支持自动收集分布式统计信息设计评审会议纪要](https://conf.yasdb.com/pages/viewpage.action?pageId=138561246)  ,Posted by qulanmeng at 十二月 15, 2023 17:20|
|---|
