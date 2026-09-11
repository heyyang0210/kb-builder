Created by 李世铭, last modified on 九月 06, 2024

# 1. 概述

支持打包docker镜像版本，支持使用docker容器部署单机单节点数据库

# 2. 需求分析

SR：    [https://pingcode.yasdb.com/pjm/items/661e77a5fd997db58adae9d2](https://pingcode.yasdb.com/pjm/items/661e77a5fd997db58adae9d2)    ?    
  #YDBRD-26439 【OM】支持docker镜像版本

设计文档：    [【OM】支持docker镜像版本](/pages/createpage.action?spaceKey=YAS&title=%E3%80%90OM%E3%80%91%E6%94%AF%E6%8C%81docker%E9%95%9C%E5%83%8F%E7%89%88%E6%9C%AC)  

## 2.1 功能点分析

开启实例：

```
docker run -d -p 1688:1688 -v /home/yashan/data:/data/yashan -e SYS_PASSWD=Cod-2023 --name yashandb yashandb:v1
```

  `  
`  

-p：容器开放的端口是1688

-v：将容器的/data/yashan挂在到/home/yashan/data

-e：  环境变量。支持如下：

|参数名|参数描述|
|:---|:---|
|SYS_PASSWD|sys用户密码，可修改|
|YAS_***|以YAS_为前缀的环境变量，***为建库参数，参考文档《工具手册/yasboot/建库参数》，如果填写的是不存在的参数，会导致部署失败。|
|DB_BLOCK_SIZE|节点参数，数据块大小，可修改|


支持个人版和正式版镜像

## 2.2 应用场景

提供一种新的部署方式，用于在用户不想配置环境时快速搭建YashanDB实例

## 2.3 约束

只支持单机单节点

# 3. 详细测试设计

## 3.1 测试设计方法

参数检查——边界值，等价类

功能验证——场景组合

## 3.2 详细测试设计

|系统级DFX分类|是否涉及|
|:---|:---|
|CT|否|
|KT|否|
|长稳|否|
|一致性|否|
|三方测试工具    
  (sqltest，sqlancer)|否|
|安全|否|
|DFR|否|
|HA|否|
|压力|否|
|性能|否|
|可维护性|否|


**参数检查**

|环境变量参数|测试点|步骤|预期|
|---|---|---|---|
|SYS_PASSWD|默认值|  
|Cod-2022|
|  
|非法值|不符合密码强度检查的密码|报错清晰|
|DB_BLOCK_SIZE|默认值|  
|8192|
|  
|非法值|取值范围以外的值|报错清晰|
|YAS_***|全量建库参数检查|  [建库参数](https://cod-doc.yasdb.com/yashandb/23.3/zh/%E5%B7%A5%E5%85%B7%E6%89%8B%E5%86%8C/yasboot/%E5%BB%BA%E5%BA%93%E5%8F%82%E6%95%B0.html)    ，指定非默认值部署|部署成功且生效参数与指定的参数值一致|
|  
|错误的建库参数|指定错误的参数名称|报错清晰|
|  
|建库参数取非法值|选取部分建库参数取非法值|报错清晰|


**功能检查**

|检查项|步骤|预期|  
|
|---|---|---|---|
|系统元数据|通过sql脚本检查docker部署与常规部署系统元数据（系统表、索引、视图、高级包）是否一致|系统元数据一致|  
|
|基础功能测试|选取部分单机ddl和dml用例测试(ddl/alter_table、ddl/index、ddl/drop_user、ddl/fk、dml/insert)|用例运行结果与预期一致|  
|
|plugin功能测试|dblink/select、gis用例|用例运行结果与预期一致|  
|
|deps功能测试|lz4用例、  S3 bucket用例|用例运行结果与预期一致|  
|
|jdbc测试|  
|  
|  
|


**场景组合**

|测试点|步骤|预期|
|---|---|---|
|常规部署docker镜像版本|通过docker load和docker run命令部署docker镜像版本数据库|部署成功|
|容器重启|1.使用docker stop和docker start重启容器,2.检查数据库数据不会发生丢失|1.容器重启后，数据库进程自动拉起,2.数据不丢失|
|yasdb_home和yasdb_data目录冲突|1.宿主机挂载的目录下存在yasdb_home和yasdb_data目录,2.docker run部署docker镜像版本数据库|部署失败并且有清晰报错|
|arm和x86平台覆盖|  
|  
|
|个人包覆盖|  
|  
|


# 4. 测试用例

# 5. 测试框架设计

install_test测试框架，需要根据需求补充功能

# 6. 测试环境说明

|IP|内存|磁盘空间|磁盘类型|CPU|操作系统|
|:---|:---|:---|:---|:---|:---|
|192.168.3.198|32G|700G|SSD|8核|centos7.0|
|192.168.3.140|32G|900G|SSD|8核|centos7.0|


# 7. 工作量评估

工作量：5  *人天*

计划测试完成时间：9/14

## Comments:

|  [](null)  ,会议纪要,2024/09/06 与会人：黄思源、刘美秀、瞿蓝孟、李世铭,1、deps功能检查增加s3 bucket用例,2、增加jdbc驱动测试,3、arm和x86平台覆盖,4、个人版本覆盖,5、文档提供基础docker操作，根据文档进行操作同时检查文档,Posted by lishiming at 九月 06, 2024 15:54|
|---|
