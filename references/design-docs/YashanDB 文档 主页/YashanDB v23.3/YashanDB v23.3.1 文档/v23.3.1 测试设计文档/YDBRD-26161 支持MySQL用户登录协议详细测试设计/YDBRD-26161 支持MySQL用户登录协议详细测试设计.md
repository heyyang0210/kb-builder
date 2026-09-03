Created by 李世铭, last modified on 六月 20, 2024

# 1. 概述

yasdb支持mysql客户端进行口令认证登录

# 2. 需求分析

SR：    [https://pingcode.yasdb.com/pjm/items/6618e207fd997db58ad822af](https://pingcode.yasdb.com/pjm/items/6618e207fd997db58ad822af)    ?    
  #YDBRD-26161 支持MySQL用户登录协议

设计文档：    [YDBRD-26161支持MySQL用户登录协议](156112096.html)  

调研文档：    [YDBRD-26161: 支持MySQL用户登录协议测试调研](https://conf.yasdb.com/pages/viewpage.action?pageId=153021741)  

## 2.1 功能点分析

- 支持mysql进行口令认证，但仅支持  sha256_password  方式
- sha256_password  口令认证协议


![](https://conf.yasdb.com/download/attachments/156112096/image2024-6-19_16-12-57.png?version=1&modificationDate=1718784778000&api=v2?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzNzExNDksImV4cCI6MTc4MjM4MTk0OX0.5uEHu9LeJgs-PMwTCBXvZX8mfVw5j0HGEioV7gQyTLs)

- 新增配置参数用于mysql非对称加密传输digest


|参数名|说明|scope|显式/隐藏|默认值|
|:---|:---|:---|---|---|
|RSA_PUBLIC_FILE|公钥文件路径|only spfile|显式|空|
|RSA_PRIVITE_FILE|私钥文件路径|only spfile|显式|空|


## 2.2 应用场景

使用mysql进行口令认证

## 2.3 约束

1. mysql口令认证仅支持通过yashan create user语句创建的用户，不支持mysql语句创建用户
1. 仅支持  sha256_password  口令认证协议


# 3. 详细测试设计

## 3.1 测试设计方法

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
|安全|是|
|DFR|否|
|HA|是|
|压力|否|
|性能|否|
|可维护性|否|


**参数检查**

|参数|测试点|  
|
|---|---|---|
|RSA_PUBLIC_FILE|生效范围|spfile|
|  
|是否为隐藏参数|否|
|  
|是否必填|是|
|  
|设置路径的文件不存在|启动mysql服务报错|
|RSA_PRIVITE_FILE|生效范围|spfile|
|  
|是否为隐藏参数|否|
|  
|是否必填|是|
|  
|设置路径的文件不存在|启动mysql服务报错|


**场景组合**

|测试点|测试场景|预期|  
|
|---|---|---|---|
|密钥对设置|设置RSA_PUBLIC_FILE及RSA_PRIVITE_FILE为正确的密钥对文件，使用mysql连接|连接成功|  
|
|  
|设置RSA_PUBLIC_FILE及RSA_PRIVITE_FILE为不配对的密钥对文件，使用mysql连接|连接失败|  
|
|  
|设置RSA_PUBLIC_FILE及RSA_PRIVITE_FILE为正确的密钥对文件，mysql客户端--server-public-key-path设置为正确的公钥文件，使用mysql连接|连接成功|  
|
|  
|设置RSA_PUBLIC_FILE及RSA_PRIVITE_FILE为正确的密钥对文件，mysql客户端--server-public-key-path设置为错误的公钥文件，使用mysql连接|连接失败|  
|
|  
|设置RSA_PUBLIC_FILE及RSA_PRIVITE_FILE为不配对的密钥对文件，mysql客户端--server-public-key-path设置为与密钥匹配的公钥文件，使用mysql连接|连接成功|  
|
|口令认证|正确设置密钥对文件，mysql连接已有sha256密文的用户|连接成功|  
|
|  
|正确设置密钥对文件，mysql连接已有sm3密文的用户|连接成功|  
|
|  
|正确设置密钥对文件，mysql连接已有sha256+sm3密文的用户|连接成功|  
|
|  
|正确设置密钥对文件，mysql连接用户输入错误密码|连接失败|  
|
|认证方法|mysql客户端设置为其他认证方式，--default-auth=mysql_native_password|连接成功|  
|
|删除用户|mysql连接用户期间drop对应用户|报错|  
|
|  
|mysql连接用户并退出会话后删除对应用户|成功|  
|
|jdbc|正确设置密钥对文件，mysql jdbc连接已有sha256密文的用户|连接成功|  
|
|  
|正确设置密钥对文件，mysql jdbc连接已有sm3密文的用户|连接成功|  
|
|  
|正确设置密钥对文件，mysql jdbc连接已有sha256+sm3密文的用户|连接成功|  
|
|  
|正确设置密钥对文件，mysql jdbc连接用户输入错误密码|连接失败|  
|
|  
|正确设置密钥对文件，connection.changeUser|报错|  
|
|内存泄漏|mysql成功连接用户后，重启数据库|不产生内存泄漏|  
|


dev分支还不支持sm3密文：等sm3支持后补测

mysql登录后进行ddl和dml操作

# 4. 测试用例

# 5. 测试框架设计

yasft测试框架

# 6. 测试环境说明

|IP|内存|磁盘空间|磁盘类型|CPU|操作系统|
|:---|:---|:---|:---|:---|:---|
|192.168.3.198|32G|700G|SSD|8核|centos7.0|
|192.168.3.140|32G|900G|SSD|8核|centos7.0|


# 7. 工作量评估

工作量：3  *人天*

计划测试完成时间：6/21

## Attachments:

[image2024-6-18_10-14-14.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlMzdhMWFkOWEzMzExZGM5NWZiIiwicmVmX2lkIjoiNjczOTZlMzc3MjgyMDZlZmI5MmYyNmYxIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcxMTQ5LCJleHAiOjE3ODI0NTc1NDl9.m6bSB50888dwol4L8fKzeVgPnu6z6uUedH0Oy0WmsWQ)

 (image/png)    


[image2024-6-18_10-13-41.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlMzdhMWFkOWEzMzExZGM5NWZkIiwicmVmX2lkIjoiNjczOTZlMzc3MjgyMDZlZmI5MmYyNmYxIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcxMTQ5LCJleHAiOjE3ODI0NTc1NDl9.OsGCwLpsM9XZ-u_cJLlVXWh49l2_8ttM0nnZy93xsEs)

 (image/png)    


[image2024-6-18_10-13-31.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlMzc4OTcwYzJhZjRmNTIxNzg4IiwicmVmX2lkIjoiNjczOTZlMzc3MjgyMDZlZmI5MmYyNmYxIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcxMTQ5LCJleHAiOjE3ODI0NTc1NDl9.EZIUov1HMzBQshUluJOR6UM8xmK7fbjCoySTDoH5do4)

 (image/png)    


[image2024-6-18_10-9-38.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlMzc4OTcwYzJhZjRmNTIxNzg5IiwicmVmX2lkIjoiNjczOTZlMzc3MjgyMDZlZmI5MmYyNmYxIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcxMTQ5LCJleHAiOjE3ODI0NTc1NDl9.pK-VwKffZ2gD2xRXvDOzKLHw4tEFGNeZnHP0uCwCQgk)

 (image/png)    


[image2024-6-18_10-0-8.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlMzc4OTcwYzJhZjRmNTIxNzhhIiwicmVmX2lkIjoiNjczOTZlMzc3MjgyMDZlZmI5MmYyNmYxIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcxMTQ5LCJleHAiOjE3ODI0NTc1NDl9.qKv6u4t79jl-8b_GKlyfsIwA0RAKXVwf0F1_5b2AkLg)

 (image/png)    
