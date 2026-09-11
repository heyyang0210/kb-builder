Created by 刘美秀, last modified on 一月 29, 2024

# 1. 概述

本文描述om 通过定时执行任务 已实现自动收集统计信息的测试设计

# 2. 需求分析

SR：  ** **    [YDBRD-22621](https://jira.yasdb.com/browse/YDBRD-22621?src=confmacro)    **-**  **OM支持自动收集分布式统计信息**  **完成**

开发设计：    [OM支持自动收集分布式统计信息 - 瞿蓝孟 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=138560399)  

## 2.1 功能点分析

### 2.1.1 功能点概要

- 范围：单机、分布式，集群拦截


- yasboot新增命令行接口
    - job子命令


|命令|说明|
|:---|:---|
|job config|生成job配置文件|
|job add|新增job|
|job apply|应用job到db|
|job cancel|取消应用job|
|job delete|删除job|
|job update|更新job|
|job list|展示job列表|
|job show|展示job详细信息|
|job execute|立即执行一次job|


### 2.1.2 功能点详情

|命令|参数名|描述|
|---|:---|:---|
|job config|**--cluster，-c**|集群名称，必填项|
|  
|**--job-name, -n**|job名称，必填项|
|  
|**--user, -u**|执行任务的db的用户名  ~~(不填写默认使用sys用户)~~  变更为必填|
|  
|**--password, -p**|执行任务的db的密码|
|  
|**--sql**|执行的sql语句，与--sql-file互斥|
|  
|**--sql-file**|执行的sql文件，与--sql互斥|
|  
|**--cron-expression, -ce**|表达式 (设置了该参数，下面三个参数失效)|
|  
|**--frequency，-f**|执行频率，默认为    `daily`    ，可选值如下：,-   `monthly`    ：每月
-   `weekly`    ：每周
-   `daily`    ：每天
-   `hourly`    ：每小时
|
|  
|**--days**|具体某天，表示每月或者每周的第几天，可填写多天 。 eg:       `1,5,6,7`    和    `1，5-7`    都表示第1、5、6和7天；,- 只有在    `monthly`    、    `weekly`    才参数有效
- 当频率为    `monthly`    ，取值范围为    `1~31`  
- 当频率为    `weekly`    ，取值范围为    `1-7`    ，表示星期一到星期天
|
|  
|**--start-time**|策略开始时间,- 当频率为    `monthly`    、    `weekly`    和    `daily`    ，格式为    `**:**`    ，表示小时和分钟；默认为    `00:00`  
- 当频率为    `hourly`    ，格式为    `**`    ，表示分钟；默认为    `0`  
|
|  
|**--config-path**|配置文件输出地址，默认为    `当前地址`  |
|job     add|**--toml，-t**|crontab策略配置文件，必填项，  解析toml配置文件中的策略，并将其存贮到sqlite3数据库中|
|job apply|**--cluster，-c**|集群名称，必填项|
|  
|**--job-name，-j**|job name，必填项|
|  
|**--node-id，-n**|节点id，必填项（后续迭代优化点：不填写的情况下，自动去寻找可用的node-id）,- 单机
- 分布式：目前统计信息要求必须是cn节点（其他节点也不会报错，om不做拦截）
|
|  
|**--group-id，-g**|节点组id（暂不支持，后续迭代优化支持）|
|job cancel|**--cluster，-c**|集群名称，必填项|
|  
|**--job-name，-j**|job name，必填项|
|job     delete|**--cluster，-c**|集群名称，必填项|
|  
|**--job-name，-j**|job name，必填项|
|  
|**--force，-f**|强制删除，选填项，默认为false，,- 若策略已经被应用，需要强制才能删除
|
|job list|**--cluster，-c**|集群名称，必填项|
|  
|**--detail，-d**|详细信息，选填项|
|  
|**--size，-s**|一页数据量，默认值为10|
|  
|**--page，-p**|当前分页，默认值为1|
|  
|**--sort，-S**|排序字段，默认为created_at|
|  
|**--order，-o**|排序，默认为dasc，可选值有：dasc和asc|
|  
|**--search**|通过列搜索；格式为rowName:searchValue|
|job   update|**--toml，-t**|crontab策略配置文件，必填项|
|  
|**--job-name，-j**|job name，必填项|
|job execute|**--job-name，-j**|job name，必填项|
|job show|**--cluster，-c**|集群名称，必填项|
|  
|**--job-name**|job name，必填项|
|  
|**--filter**|用来过滤成功/成功的记录|


### 2.1.3 定时策略流程

1. 生成配置：执行job config，yasboot 生成job配置，校验除sql/sql-file外的入参格式、  ~~值的有效性、用户名密码正确性~~

2.   添加job：  执行  job     add，  解析toml配置文件中的策略，yasom_api将其持久化到sqlite3数据库中，

3.应用job：执行job apply，  yasom_api从yasom_sqlite3中  查询job和集群信息，并返回查询结果给  yasom_api，  值的有效性、用户名密码正确性

yasom_api给yasom_cron模块下发定时任务，

4.到了策略中配置的定时的时间后，触发yasom_cron将定时任务发给到yasom_task中，或者执行job execute---yasom_task

5.yasom_task下发指令给yasagent，yasgent调用yasql执行配置中的sql语句或文件，

6.返回sql的直接结果，并将结果持久化到yasom_sqlite3中

7.job show可以查询job的执行结果

![](https://pingcode.yasdb.com/atlas/files/public/67396bb1a1ad9a3311dc84ce/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFFQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUJBQUFBQUFFQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBRUFBQUFJQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTYzNDYsImV4cCI6MTc4MjMwNzE0Nn0.Fh2XKFhaG1GyvrwlF7s_JjMGcuFCv-gPsD--g9aD_hU)

## 2.2 应用场景

- 需求本身的主要应用场景：用于表级、schema级、database级的 定时统计信息收集
- 需求与其他特性的关联场景：


## 2.3 规格约束

- job apply   **--group-id，-g **  节点组id（暂不支持，后续迭代优化支持）
- 后续迭代优化点：不填写的情况下，自动去寻找可用的node-id


# 3. 详细测试设计

## 3.1 测试设计方法

- 入参验证：边界值；等价类划分
- 流程验证：路径覆盖
- 业务校验，HA验证，交互验证-场景组合


## 3.2 详细测试设计

### *3.2.1 入参验证：*

|命令|参数名|描述|测试点|取值|备注|
|---|:---|:---|---|---|---|
|job config|**--cluster，-c**|集群名称，必填项|单机集群|minidb|  
|
|  
|  
|  
|分布式集群|yashan|  
|
|  
|  
|  
|不指定该参数|  
|拦截|
|  
|  
|  
|取值为null|''|拦截|
|  
|  
|  
|错误集群名|  
|拦截|
|  
|**--job-name, -n**|job名称，必填项|cron|数字、字母、特殊字符|  
|
|  
|  
|  
|长度验证=64|  
|实际无约束|
|  
|  
|  
|长度验证 超过64|  
|  
|
|  
|  
|  
|取值为null|''|  
|
|  
|  
|  
|重复job name|  
|目前不会报错--待定|
|  
|**--user, -u**|执行任务的db的用户名(不填写默认使用sys用户)|不指定|  
|  
|
|  
|  
|  
|指定为自定义用户|  
|  
|
|  
|  
|  
|取值为null|-u ''|  
|
|  
|  
|  
|不存在用户|  
|  
|
|  
|  
|  
|正确用户名长度验证=64|  
|  
|
|  
|**--password, -p**|执行任务的db的密码|正确密码长度验证=64|  
|设置了用户名密码必填|
|  
|  
|  
|正确密码包含    `%`    ，    `\`    ，    `;`    ，    `@`    ，    `/`  |  
|  
|
|  
|  
|  
|错误密码|  
|  
|
|  
|  
|  
|用户名为sys，不指定密码|  
|拦截|
|  
|  
|  
|不指定用户名、指定密码为sys用户的密码|  
|拦截|
|  
|**--sql**|执行的sql语句，与--sql-file互斥|指定多条sql，且每条sql用;分隔|  
|  
|
|  
|  
|  
|sql为匿名块，指定多行sql|  
|  
|
|  
|  
|  
|sql为CTE|  
|  
|
|  
|  
|  
|同时指定sql和sql-file|  
|拦截|
|  
|  
|  
|null|  
|  
|
|  
|**--sql-file**|执行的sql文件，与--sql互斥|指定多条sql，且每条sql用;分隔|  
|  
|
|  
|  
|  
|ql为匿名块，指定多行sql|  
|  
|
|  
|  
|  
|sql为CTE|  
|  
|
|  
|  
|  
|sql文件不存在|  
|待确认是在配置还是在应用校验|
|  
|  
|  
|指定文件为绝对路径|  
|  
|
|  
|  
|  
|指定文件为相对路径|  
|  
|
|  
|  
|  
|指定文件为非sql文本|文本内容为111|  
|
|  
|  
|  
|null|  
|  
|
|  
|  
|  
|不指定sql和sql-file|  
|  
|
|  
|**--cron-expression, -ce**|表达式 (设置了该参数，下面三个参数失效),- 格式：    `* * * * *`    ，分别表示：    `分钟、小时、天、月、周`  
|仅指定分钟|  
|验证配置成功、应用成功、对应时间实际生效|
|  
|  
|  
|仅指定小时|  
|不指定时的默认值是00:00或0|
|  
|  
|  
|仅指定天|  
|指定月份默认第一天|
|  
|  
|  
|仅指定月|  
|不指定时的默认值是|
|  
|  
|  
|仅指定周|  
|不指定时的默认值是|
|  
|  
|  
|多个日期|"10 12 1,5,6,7 ? *"|*表示任何数字，？表示忽略该字段|
|  
|  
|  
|是否支持短参数-ce？|  
|待确认是否需要---|
|  
|**--frequency，-f**|执行频率，默认为    `daily`    ，可选值如下：,-   `monthly`    ：每月
-   `weekly`    ：每周
-   `daily`    ：每天
-   `hourly`    ：每小时
|  `monthly`  |  
|  
|
|  
|  
|  
|  `weekly`  |  
|  
|
|  
|  
|  
|  `daily`  |  
|  
|
|  
|  
|  
|  `hourly`  |  
|  
|
|  
|**--days**|具体某天，表示每月或者每周的第几天，可填写多天 。 eg:       `1,5,6,7`    和    `1，5-7`    都表示第1、5、6和7天；,- 只有在    `monthly`    、    `weekly`    才参数有效
- 当频率为    `monthly`    ，取值范围为    `1~31`  
- 当频率为    `weekly`    ，取值范围为    `1-7`    ，表示星期一到星期天
|1个日期|  
|  
|
|  
|  
|  
|多个日期|-d 1,5-7|  
|
|  
|  
|  
|无效值|-d 32|  
|
|  
|  
|  
|不指定-d|-f daily |  
|
|  
|  
|  
|null|-f     `daily -d ''`  |  
|
|  
|**--start-time**|策略开始时间,- 当频率为    `monthly`    、    `weekly`    和    `daily`    ，格式为    `**:**`    ，表示小时和分钟；默认为    `00:00`  
- 当频率为    `hourly`    ，格式为    `**`    ，表示分钟；默认为    `0`  
|monthly、weekly和daily时指定时间|  
|  
|
|  
|  
|  
|hourly时指定时间|  
|  
|
|  
|  
|  
|无效时间|25:00|  
|
|  
|**--config-path**|配置文件输出地址，默认为    `当前地址`  |绝对路径|  
|  
|
|  
|  
|  
|相对路径|  
|  
|
|  
|  
|  
|不存在路径|  
|  
|
|  
|  
|  
|存在但无权限路径|  
|  
|
|job     add|**--toml，-t**|crontab策略配置文件，必填项，  解析toml配置文件中的策略，并将其存贮到sqlite3数据库中|正确toml|  
|  
|
|  
|  
|  
|绝对路径|  
|  
|
|  
|  
|  
|相对路径|  
|  
|
|  
|  
|  
|不存在toml|  
|  
|
|  
|  
|  
|无读权限|  
|  
|
|job apply|**--cluster，-c**|集群名称，必填项|校验函数同上，此处不再重复验证|  
|  
|
|  
|**--job-name，-j**|job name，必填项|存在name|  
|  
|
|  
|  
|  
|不存在name|  
|  
|
|  
|**--node-id，-n**|节点id，必填项（后续迭代优化点：不填写的情况下，自动去寻找可用的node-id）,- 单机
- 分布式：目前统计信息要求必须是cn节点（其他节点也不会报错，om不做拦截）
|单机主节点|  
|  
|
|  
|  
|  
|单机备节点|  
|  
|
|  
|  
|  
|分布式DN主节点|  
|  
|
|  
|  
|  
|分布式DN备节点|  
|  
|
|  
|  
|  
|分布式MN主节点|  
|  
|
|  
|  
|  
|分布式MN备节点|  
|  
|
|  
|  
|  
|CN|  
|  
|
|  
|  
|  
|不存在的节点|  
|  
|
|  
|  
|  
|stop的节点|  
|  
|
|  
|  
|  
|mount状态|  
|  
|
|  
|  
|  
|nomount|  
|  
|
|  
|  
|  
|指定多个节点|报错|  
|
|  
|~~**--group-id，-g**~~|~~节点组id（暂不支持，后续迭代优化支持）~~|  
|  
|未实现，本轮也不会展示在产品文档|
|job cancel|**--cluster，-c**|集群名称，必填项|校验函数同上，此处不再重复验证|  
|  
|
|  
|**--job-name，-j**|job name，必填项|存在name|  
|  
|
|  
|  
|  
|不存在name|  
|  
|
|  
|**--node-id，-n**|节点id，必填项|不指定|报错|  
|
|  
|  
|  
|job-name和node-id不匹配|  
|  
|
|job     delete|**--cluster，-c**|集群名称，必填项|校验函数同上，此处不再重复验证|  
|  
|
|  
|**--job-name，-j**|job name，必填项|存在name|  
|  
|
|  
|  
|  
|不存在name|  
|  
|
|  
|**--force，-f**|强制删除，选填项，默认为false，,- 若策略已经被应用，需要强制才能删除
|策略未应用。不指定-f|  
|  
|
|  
|  
|  
|策略已应用，不指定-f|  
|报错|
|  
|  
|  
|策略已应用，指定-f|  
|  
|
|job list|**--cluster，-c**|集群名称，必填项|校验函数同上，此处不再重复验证|  
|  
|
|  
|**--detail，-d**|详细信息，选填项|指定|  
|内容正确|
|  
|  
|  
|不指定|  
|  
|
|  
|**--size，-s**|一页数据量，默认值为10|指定|1|  
|
|  
|  
|  
|  
|100|  
|
|  
|  
|  
|  
|最大值15|  
|
|  
|  
|  
|不指定|  
|  
|
|  
|**--page，-p**|当前分页，默认值为1|指定|2|  
|
|  
|  
|  
|  
|10|  
|
|  
|  
|  
|  
|最大值|  
|
|  
|  
|  
|不指定|  
|  
|
|  
|**--sort，-S**|排序字段，默认为created_at|字段覆盖|  
|  
|
|  
|**--order，-o**|排序，默认为dasc，可选值有：dasc和asc|不指定|  
|  
|
|  
|  
|  
|asc|  
|  
|
|  
|**--search**|通过列搜索；格式为rowName:searchValue|字段覆盖|  
|  
|
|job   update|**--toml，-t**|crontab策略配置文件，必填项|绝对路径|  
|  
|
|  
|  
|  
|相对路径|  
|  
|
|  
|  
|  
|不存在文件|  
|  
|
|  
|  
|  
|存在但无权限文件|  
|  
|
|  
|**--job-name，-j**|job name，必填项|存在name|  
|  
|
|  
|  
|  
|不存在name|  
|  
|
|job execute|**--job-name，-j**|job name，必填项|存在name|  
|  
|
|  
|  
|  
|不存在name|  
|  
|
|job show|**--cluster，-c**|集群名称，必填项|校验函数同上，此处不再重复验证|  
|  
|
|  
|**--job-name**|job name，必填项|存在name|查找失败结果？|  
|
|  
|  
|  
|不存在name|  
|  
|
|  
|**--filter**|用来过滤成功/成功的记录|  
|  
|  
|


### 3.2.3业务及流程验证

**业务验证**  ：

|验证项|测试点|备注|
|---|---|---|
|生成配置时入参校验|非法类型|生成配置时仅对参数类型进行校验，并不会对参数值的正确性校验，如不会校验集群名称是否正确|
|应用策略时配置校验-修改配置后添加|如上表格|校验配置文件内的参数的有效性和正确性|
|  
|配置文件中同时配置--cron-expression和--frequency，--cron-expression在前|表达式为主|
|  
|配置文件中同时配置--cron-expression和--frequency，--frequency在前|表达式为主|
|  
|cron-expression表达式格式不正确|  
|
|sql|指定-sql，多行sql，有成功有失败|  
|
|  
|指定-sql-file，多行sql，有成功有失败|  
|
|  
|指定-sql-file，多行sql，都是成功|  
|
|  
|指定-sql-file，多行sql，都是成功|  
|
|job add|一个toml add 多次|  
|
|job apply|主备同时应用任务|  
|
|  
|一个job name 连续apply多次|同一个node-id多次添加报错|
|job cancel|cancel已添加策略但未应用|  
|
|  
|cancel 已应用策略|  
|
|  
|cancel后再次应用|  
|
|job     delete|delete  已添加策略但任务未应用|任务被删除后job show、job list内的对应的任务内容也会被删除|
|  
|delete已应用策略 -f|  
|
|  
|delete  已添加策略，且已execute|无关|
|  
|delete已应用且已下发过的任务|  
|
|  
|delete 后再次add|  
|
|job execute|执行未应用的任务|报错|
|  
|执行已应用的任务|  
|
|job update|config新生成的配置，job name和原来的name 不一致|仅保留job name|
|  
|config新生成的配置，username和原来的name 不一致|  
|
|  
|修改原有的toml的配置时间后update|  
|
|日志|查看yasom和yasagent，有对应任务日志，|  
|


**交互场景验证**

|验证项|验证点|备注|
|:---|:---|:---|
|审计|定时任务中执行的sql能被记录到审计中|  
|
|备份恢复|job-name和备份策略name重复|  
|
|  
|定时任务和备份时间为同一时间|  
|
|  
|定时任务时间和单机的job为同一时间|  
|


  


**3.2.4 DFX**

|验证项|验证点|备注|
|:---|:---|:---|
|DFR|job add 时yasom故障|  
|
|  
|job apply时yasom故障|  
|
|  
|定时时间前yasagent故障|  
|
|  
|定时时间前节点故障|  
|
|  
|任务执行时主备切换|  
|
|并发|同一CN 同一时间有多个定时任务|  
|
|  
|不同节点同一时间有多个定时任务|  
|
|  
|多个CN同时收集，不同CN各收集table、database、schema|  
|
|  
|CN、DN、MN同时收集统计信息|  
|
|安全性|生成的策略配置中的密码非明文密码|  
|
|  
|查看日志文件不打印明文密码|  
|


  


|系统级DFX分类|是否涉及|
|:---|:---|
|CT|是|
|KT|是|
|长稳|不涉及|
|一致性|不涉及|
|三方测试工具    
  (sqltest，sqlancer)|不涉及|
|安全|是，日志安全，密码安全|
|DFR|不涉及|
|HA|是|
|压力|不涉及|
|性能|不涉及|
|可维护性|不涉及|


  


# 4. 测试用例

冒烟用例

```
job config生成配置
job add 添加策略
job apply 应用配置
job list 查看到新添加的job
到配置定时的时间后查看任务是否执行
job show 查看到已执行的job结果
job execute 能立即执行对应的任务

job config生成新的配置，变更表达式
job update变更已有job时间，-toml指定新生成的配置
job list 查看任务已变更为新的表达式
到配置定时的时间后查看任务是否执行
job show 查看到前一次和这一次执行的job结果
job cancel 后到下一次定时的时间时不会再执行定时任务
job delete 后从job list 和 job show中查看不到该job name相关的任务
```

  


文本用例

# 5. 测试框架设计

|验证项|框架|
|:---|:---|
|FT|install_test|


# 6. 测试环境说明

*测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等*

|服务器类型|操作系统|内存|磁盘空间|CPU|服务器个数|部署节点|
|:---|:---|:---|:---|:---|:---|:---|
|VM|CentOS Linux release 7.6.1810 (Core)|26G|750G|8C|2|3mn2cn3dn|


  


# 7. 工作量评估

工作量：7  *人天*

计划测试完成时间：

  


## Attachments:

[image2023-11-23_19-43-56.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYjFhMWFkOWEzMzExZGM4NGNiIiwicmVmX2lkIjoiNjczOTZiYjE3MjgyMDZlZmI5MmYwOTEwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2MzQ2LCJleHAiOjE3ODIzODI3NDZ9.EDI0bjWfTGfm7HlDvqfKQ9LurLv7Oz55gY4J4ZO7TIk)

 (image/png)    


[image2023-11-23_19-46-7.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYjFhMWFkOWEzMzExZGM4NGNjIiwicmVmX2lkIjoiNjczOTZiYjE3MjgyMDZlZmI5MmYwOTEwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2MzQ2LCJleHAiOjE3ODIzODI3NDZ9.jdx5Bd2VsMXU7EdOaSdnerCcZrFgi2jZvU3Utt85epk)

 (image/png)    


[image2023-11-23_20-2-1.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYjE4OTcwYzJhZjRmNTIwNjU2IiwicmVmX2lkIjoiNjczOTZiYjE3MjgyMDZlZmI5MmYwOTEwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2MzQ2LCJleHAiOjE3ODIzODI3NDZ9.nn2n3k73QJw4E-HWqasG6cuemIWDoM2IbkwbeVPgBXw)

 (image/png)    


[OM支持自动收集分布式统计信息测试用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYjE4OTcwYzJhZjRmNTIwNjU3IiwicmVmX2lkIjoiNjczOTZiYjE3MjgyMDZlZmI5MmYwOTEwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2MzQ2LCJleHAiOjE3ODIzODI3NDZ9.9PLpLsa5l0VXrnp36jYbAWovwq11f2OhSxhnBPH_2SQ)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


## Comments:

|  [](null)  ,会议纪要：    
  与会人：瞿蓝孟，陈步隆，张璐恒，刘美秀    
  会议时间：2023/12/19 17:00-18:00    
  会议时间：1012    
  纪要信息：    
  1.信息同步：生成配置时仅对入参格式进行校验，不会对参数的正确性如密码是否正确进行校验，在应用时才会校验参数的正确性    
  2.信息同步：配置中只要有--cron-expression就以--cron-expression为主，会忽略掉--frequency    
  3.信息同步：执行未应用策略会报错、job update使用原有的job id且不会对新配置的job-name等校验是否和原有的一致    
  4.待确认： --sql-file 路径校验 是在生成配置还是应用job时校验--蓝孟    
  5.待确认：--cron-expression 在定时任务缺少短参数-ce，在备份恢复中是有该短参数的，两种需要保持一致，待和备份恢复对齐--蓝孟    
  6.设计新增：job show 需要支持 查找指定结果的任务，如查找执行失败的任务--蓝孟    
  7.资料新增：定时自动生成统计信息的指导示例需要在资料中体现    
  8.专项风险：    
  原因：(1)转测延迟 (2)前期无设计作为依据，对于自动收集统计信息SR工作量评估乐观    
  全库收集统计信息SR测试工作量：7人天，测试时间：12.21-12.30    
  自动收集统计信息SR测试工作量：7人天，测试时间：1.2-1.10,Posted by liumeixiu at 十二月 19, 2023 19:14|
|---|
|  [](null)  ,新华：,补一个观察点：增加定时任务后，要观察一段时间(12小时) yasom， yasgent进程内存，cpu变化,来源：外场出现一个开启election功能后，yasagent内存泄漏，是yasagent和db有定时交付，存在资源未释放,Posted by liumeixiu at 十二月 20, 2023 09:12|
|  [](null)  ,4.生成配置时候校验；    
  5.保留ce短参，跟备份命令保持一致；    
  6.增加参数--filter，用来过滤成功/成功的记录,Posted by liumeixiu at 十二月 20, 2023 14:59|
