Created by 陈钦卿, last modified on 七月 12, 2024

# 1. 概述

SR：    [https://pingcode.yasdb.com/pjm/items/661e76f9fd997db58adae99f](https://pingcode.yasdb.com/pjm/items/661e76f9fd997db58adae99f)    ? #YDBRD-26437 【yasql】【CCB转需求】数据库没有进程时，通过yasql连接数据库出错后建议优化退出

开发设计：    [YDBRD-26437特性设计文档 - 刘亮杰 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=159420336)  

交付形态：单机、分布式、集群

# 2. 需求分析

## 2.1 功能点分析

当数据库进程不存在时，优化yasql连接退出，  不需要输入3次用户名和密码

## 2.2 应用场景

数据库没有进程

## 2.3 规格约束

如果没有输入用户名或者没有输入密码，不会尝试连接服务端，无法知晓是否存在进程，故仍要输入三次用户名和密码。

# 3. 详细测试设计

## 3.1 测试设计方法

*对本测试设计中使用的工程方法及适用的场景分类做说明，如常用的边界值，等价类，流程图及相关的组合策略*

*如：内置函数入参–边界值；等价类*

*语法图–路径覆盖*

## 3.2 详细测试设计

### **yasql连接语句示例：yasql sys/Cod-2022@192.168.130.137:1688**

|测试场景|测试项一|预期|
|:---|:---|:---|
|基本场景-无数据库进程|yasql语句正确|报错一次，不再需要输入三次才能退出程序,YAS-00402 failed to connect socket, errno 111, error message "Connection refused",![](https://pingcode.yasdb.com/atlas/files/public/67396da6a1ad9a3311dc92cf/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBSUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBUUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFRQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFFQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFCQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTAzNjUsImV4cCI6MTc4MjMyMTE2NX0.lgB7iDLjMIrUe3eElBZo8XdgdbGPpexWj8E1975704A)|
|  
|用户名错误/未输入||
|  
|密码错误/未输入||
|  
|IP错误/未输入||
|  
|端口错误/未输入||
|  
|符号错误||
|  
|仅yasql|  
|
|  
|yasql -c|  
|
|  
|yasql -s 静默登录|  
|
|  
|域名登录|手动测试|
|  
|/nolog|  
|
|  
|yasql / as sysdba|  
|
|分布式|无cn进程|连接cn报错|
|  
|无dn进程|连接dn报错|
|  
|无mn进程|  
|
|集群|部分实例无进程|  
|
|**正常情况下，有数据库进程**|ip错误，ip无关，未输入|输入一次|
|  
|端口错误，无关，未输入|输入一次|
|Windows|  
|  
|


|系统级DFX分类|是否涉及|测试点|
|---|---|---|
|CT|  
|  
|
|KT|  
|  
|
|长稳|  
|  
|
|一致性|  
|  
|
|三方测试工具    
  (sqltest，sqlancer)|  
|  
|
|安全|  
|  
|
|DFR|  
|  
|
|HA|  
|  
|
|压力|  
|  
|
|性能|  
|  
|
|可维护性|  
|  
|


  


# 4. 测试用例

1. 测试设计评审时提供冒烟文本用例；
1. 启动测试之前提供文本用例，并完成大部分自动化用例；


详见附件

# 5. 测试框架设计

- guider


# 6. 测试环境说明

*测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等*

|**服务器**|** **|
|:---|:---|
|操作系统|Linux|
|部署|单机|


# 7. 工作量评估

工作量：  *xx人天*

计划测试完成时间：

[详细测试设计文档模板.doc](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkYTZhMWFkOWEzMzExZGM5MmNlIiwicmVmX2lkIjoiNjczOTZkYTY1OTNmOTljOWZmMjM3ZGZmIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEwMzY1LCJleHAiOjE3ODIzOTY3NjV9.-8rWkAvdBnHfjET5HA3EDscgfi2a9mZGO9fO4OCV3SU)

## Attachments:

[详细测试设计文档模板.doc](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkYTZhMWFkOWEzMzExZGM5MmNlIiwicmVmX2lkIjoiNjczOTZkYTY1OTNmOTljOWZmMjM3ZGZmIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEwMzY1LCJleHAiOjE3ODIzOTY3NjV9.-8rWkAvdBnHfjET5HA3EDscgfi2a9mZGO9fO4OCV3SU)

 (application/msword)    


[XXX功能测试设计.doc](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkYTY4OTcwYzJhZjRmNTIxNDViIiwicmVmX2lkIjoiNjczOTZkYTY1OTNmOTljOWZmMjM3ZGZmIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEwMzY1LCJleHAiOjE3ODIzOTY3NjV9.2Kj8oCoA9vAJNaC3kcg_0O5ArYk8hLi3hiqp5l9dEe8)

 (application/msword)    
