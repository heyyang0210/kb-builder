Created by 李凯峰, last modified on 十二月 19, 2023

**测试详细设计目的：**    
  **1.继承需求调研文档和测试概要设计，并补充开发设计机制、内部规格等来完善测试设计**    
  **2.梳理测试点，指导测试用例撰写**

# 1. 概述

SR:  [https://pingcode.yasdb.com/ship/ideas/67590ae0c3c68d84e9d6847d?](https://pingcode.yasdb.com/ship/ideas/67590ae0c3c68d84e9d6847d?)  

#YASHAN-3537  安装时支持安装包自校验功能

设计文档:

调研文档：

# 2. 需求分析

## 2.1 功能点分析

- yasboot新增check安装包hash值的命令
- 更改yashan安装包内部文件后部署安装报错


## 2.2 应用场景

- 安可测评
- 用于安装前检验安装包未被篡改


## 2.3 规格约束

# 3. 详细测试设计

## 3.1 测试设计方法

根据需求主要采用：

等价类、边界值、场景法、错误推测法编写测试设计

## 3.2 详细测试设计

1. *使用章节3.1的测试方法设计详细的功能测试点，可借用xmind的方式*


|测试项|测试点|有效等价类|备注|无效等价类|备注|
|---|---|---|---|---|---|
|部署模式|单机,分布式,集群|不修改包内的内容，能正常部署||修改包内的内容，hash值不一致部署失败||
|功能|yasboot package verify命令语法测试|verify 大小写，拼写错误||||
|||在yasboot所在目录执行命令|执行成功|||
|||在其他目录执行命令|报错|||
||解压后修改/删除安装包目录内文件内容，重新打包后yasboot校验安装包是否被篡改（修改比如可以用老版本的文件去替换这些目录中的文件，或者直接修改）|需要修改的目录：,bin目录,lib目录,plugins目录,depends目录 ,om目录|校验包已被篡改，且无法正常部署yashan|||
|||解压后只需要修改，执行yasboot检查是否篡改,plugins目录,depends目录 ,om目录||||
|||||修改校验后，尝试部署yashan|预期部署失败|
|||||修改文件重新打包后，再解压包，把修改的文件改回去，yasboot验证是否被篡改|预期已被篡改|
|||||解压安装包，不做修改，重新打包成gz包，校验||
|||||修改文件重新打包后，再解压包，把修改的文件改回去，再次打包，yasboot check是否被篡改|此处是否应该部署失败且校验为包已被篡改？|
|||||单独修改plugins包内的内容，重新打包plugins，部署yashan+plugins|预期部署失败|
|||||单独部署yashan包内的内容，重新打包yashan，部署yashan+plugins|预期部署失败|
|||||同时修改yashan+plugins中的文件，部署yashan+plugins|预期部署失败|
|升级|从低版本升级到需求版本|升级成功且升级后yasboot check功能能正常使用||||
|跑上车|不影响二层CI即可|||||


1. *梳理该特性是否涉DFX测试，并在详细设计中描述具体测试点，可借用xmind的方式*


|系统级DFX分类|是否涉及|
|---|---|
|CT|不涉及|
|KT|不涉及|
|长稳|不涉及|
|一致性|不涉及|
|三方测试工具    
  (sqltest，sqlancer)|不涉及|
|安全|不涉及|
|DFR|不涉及|
|HA|不涉及|
|压力|不涉及|
|性能|不涉及|
|可维护性|涉及|


  


# 4. 测试用例

1. 测试设计评审时提供冒烟文本用例；
1. 启动测试之前提供文本用例，并完成大部分自动化用例；


# 5. 测试框架设计

- operators_perf框架


# 6. 测试环境说明

|服务器类型|os|  
|
|:---|:---|:---|
|vm|centos|单机/集群|


# 7. 工作量评估

工作量：8  *人天*

计划测试完成时间：2023/11/21日

[详细测试设计文档模板.doc](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjc1YmE3M2RkMmJhZmYwZmQ1NWMyMTkzIiwicmVmX2lkIjoiNjc1YmE3M2RkMmJhZmYwZmQ1NWMyMTllIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzI0MjkyLCJleHAiOjE3ODI0MTA2OTJ9.w0KvT-vJqgo93ReYecc_QfUP4pA66nrxKJYzRoaABp8)

## Attachments:

[详细测试设计文档模板.doc](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjc1YmE3M2RkMmJhZmYwZmQ1NWMyMTkzIiwicmVmX2lkIjoiNjc1YmE3M2RkMmJhZmYwZmQ1NWMyMTllIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzI0MjkyLCJleHAiOjE3ODI0MTA2OTJ9.w0KvT-vJqgo93ReYecc_QfUP4pA66nrxKJYzRoaABp8)

 (application/msword)    


[XXX功能测试设计.doc](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjc1YmE3M2RkMmJhZmYwZmQ1NWMyMTkxIiwicmVmX2lkIjoiNjc1YmE3M2RkMmJhZmYwZmQ1NWMyMTllIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzI0MjkyLCJleHAiOjE3ODI0MTA2OTJ9.sGH3G5ApIggHSMkoGRuS8v7sphHJEKM992QzoE7Sunk)

 (application/msword)    




 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    




 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    
