Created by 徐卓, last modified on 五月 07, 2024

# 1. 概述

本特性的主要功能就是把ycsctl的标准输入和输出，以及一些工具操作中的关键日志写入日志里。

开发设计文档：    [【YCS】支持ycsctl工具记录日志详细设计](150604858.html)  

*IR链接：*  *  *    [YDBRD-29168](https://jira.yasdb.com/browse/YDBRD-29168)    * - *  *YCR支持记录日志*  * *  *待内部评审*

*SR链接：*  *  *    [YDBRD-29719](https://jira.yasdb.com/browse/YDBRD-29719)    * - *  *支持ycsctl工具记录日志*  * *  *待启动*  *  
*

# 2. 需求分析

## 2.1 功能点分析

- 本需求主要功能：将ycsctl工具相关交互的关键信息写入日志


## 2.2 应用场景

- *关键信息写入日志有利于外场环境问题定位*


## 2.3 规格约束

1、部署形态：集群    
  2、实例个数：4    
  本SR原则上与实例数目无关。

# 3. 详细测试设计

## 3.1 测试设计方法

本次测试设计主要采用等价类、场景法、错误推测法。

并发一定次数的ycsctl操作，验证日志中关键信息是否正确，并且与并发次数对等。

本SR主要针对ycsctl工具写入日志，验证日志中关键信息的准确性，与工具操作的一致性。

## 3.2 详细测试设计

![](https://pingcode.yasdb.com/atlas/files/public/67396d1a8970c2af4f52104c/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFRQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBRUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBSUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQVFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDU4MjcsImV4cCI6MTc4MjMxNjYyN30.M-Q8IoK3IJk5-pm88d-oUzZj3OnNg--8WkX1saiElfg)

|  
|场景|详细步骤|预期结果|备注|结论|
|---|---|---|---|---|---|
|1|不记录日志场景|检验涉及命令，是否出现在日志中|不记录日志|  
|  
|
|2|ycsctl正常执行业务|检测涉及命令，是否出现在日志中，并校验打印信息是否正确|日志中有关键信息打印，且打印信息正确|  
|  
|
|3|ycsctl业务报错场景|ycsctl set 配置参数填写非法值，校验日志中错误码信息是否匹配|日志中有关键信息打印，且打印信息正确|  
|  
|
|4|日志写满|测试日志总量即将写满时，业务操作中是否会提示需清理日志的相关提示,及日志总量超过200M时，是否正确覆盖最早日志|总量超过200m，正确覆盖最早日志|待确认日志即将写满场景下，业务操作是否会警告提示|  
|
|5|低于并发限制场景|并发执行多条读写命令并同时执行ycsctl set命令|日志信息与操作匹配，且信息准确，|  
|  
|
|6|高于并发限制场景|并发执行多条ycsctl set ，验证日志中写入的次数是否与并发执行的次数一致|日志信息与操作匹配，日志写入次数与并发执行次数一致|  
|  
|
|7|跨实例并发场景|验证四实例场景下，业务操作正确写入一份日志，并互不影响|正确写入日志，无异常|  
|  
|
|8|埋点场景测试|验证预置埋点后，执行相关ycsctl set 操作是否报错正确|报错正确，无core无异常|  
|  
|


## 3.3 是否涉及DFX测试

|系统级DFX分类|是否涉及|
|:---|:---|
|CT|并发测试已经考虑，主要是业务的并发，用HA框架实现|
|KT|不涉及|
|长稳|不涉及，本SR不涉及DB业务|
|一致性|不涉及|
|三方测试工具    
  (sqltest，sqlancer)|不涉及|
|安全|不涉及，该需求不涉及用户密码/用户权限等安全性相关因素，所以不涉及安全专项|
|DFR|不涉及|
|HA|不涉及主备集群|
|压力|不涉及，本SR不涉及DB业务|
|性能|不涉及，本SR不涉及DB业务|
|可维护性|本SR所有用例均会自动化看护|


# 4. 测试用例

开发门槛用例：    
  测试用例：

[支持工具记录日志测试用例.xls](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMWE4OTcwYzJhZjRmNTIxMDRiIiwicmVmX2lkIjoiNjczOTZkMWE3MjgyMDZlZmI5MmYxYjJiIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA1ODI3LCJleHAiOjE3ODIzOTIyMjd9.NKSFyRPFFewXx2YFK7CQ6H4lX6bAizs3gXhOglgKg84)

  


## **5、测试框架设计**

本次测试使用HA框架实现

## **6、测试环境说明**

|服务器|双机磁阵|
|:---|:---|
|操作系统|Linux x86/arm|
|部署|  
|


## **7. 工作量评估**

工作量：7人天

  


## Attachments:

[支持工具记录日志测试用例.xls](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMWE4OTcwYzJhZjRmNTIxMDRiIiwicmVmX2lkIjoiNjczOTZkMWE3MjgyMDZlZmI5MmYxYjJiIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA1ODI3LCJleHAiOjE3ODIzOTIyMjd9.NKSFyRPFFewXx2YFK7CQ6H4lX6bAizs3gXhOglgKg84)

 (application/vnd.ms-excel)    


## Comments:

|  [](null)  ,补充：检验命令报错是否合理,Posted by xuzhuo at 四月 25, 2024 10:44|
|---|
