Created by 施新华 on 十一月 14, 2023

# **1、概述**

巡检支持集群数据库和ycs资源信息收集

SR：    [YDBRD-13321](https://jira.yasdb.com/browse/YDBRD-13321?src=confmacro)    -  【OM】巡检支持集群数据库和ycs资源信息收集  完成

设计文档：    [【接口设计文档】23.1 OM支持一键收集数据库信息](119561015.html)  

# **2、需求分析**

## **2.1 需求描述**

信息收集

- 主机信息
- yasdb进程的gstack
- SQL收集(包括awr等信息)


巡检

- 支持单机、分布式、集群
- 支持配置收集模块
- 支持查询巡检记录、下载巡检结果


## **2.2 功能特性**

### 2.2.1   信息收集  命令

|命令|说明|
|:---|:---|
|collection all|收集以上所有模块的信息|
|collection gstack|收集yasdb进程gstack信息|
|collection host|收集主机信息|
|collection sql|收集数据库信息|


### 2.2.2 生成配置文件命令

|命令|说明|
|:---|:---|
|config patrol gen|生成巡检策略配置文件|
|config host gen|生成主机检查的配置文件|
|config sql gen|生成数据库信息收集的sql配置文件|


### 2.2.3 巡检策略命令

|命令|说明|
|:---|:---|
|patrol strategy add|添加巡检策略|
|patrol strategy apply|应用巡检策略|
|patrol strategy cancel|取消应用巡检策略|
|patrol strategy delete|删除巡检策略|
|patrol strategy list|展示巡检策略列表|


### 2.2.3 巡检结果命令

|命令|说明|
|:---|:---|
|patrol report list|展示巡检报告记录列表|
|patrol report get|下载巡检报告结果文件|
|patrol report delete|删除巡检报告|


## **2.3 特性约束**

- 巡检报告只支持保存在OM所在主机
-   `PERIOD`    类型策略下发的巡检任务的最小间隔时间为1小时
- 巡检策略下发任务时，前一次巡检任务没有完成，当前巡检任务会下发任务失败


# **3、测试设计方法**

1. 功能性：参数校验、结合业务场景、修改配置文件中参数
1. 部署形态：三实例共享集群
1. 测试环境：linux
1. 可靠性、异常：异常环境
1. 易用性：使用过程是否简单易上手，报错是否明确


# **4、详细测试设计**

## **4.1 参数验证**

|命令|参数|说明|测试策略|
|---|---|---|---|
|collection host|--cluster, -c|yasdb名称|--cluster yashan,-c yashan|
|  
|--host|  
|  
|
