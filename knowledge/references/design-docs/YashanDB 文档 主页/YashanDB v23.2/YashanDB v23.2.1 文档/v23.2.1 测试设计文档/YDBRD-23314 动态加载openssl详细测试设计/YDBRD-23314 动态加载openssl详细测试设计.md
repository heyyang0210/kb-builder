Created by 李凯峰, last modified on 一月 08, 2024

**测试详细设计目的：**    
  **1.继承需求调研文档和测试概要设计，并补充开发设计机制、内部规格等来完善测试设计**    
  **2.梳理测试点，指导测试用例撰写**

# 1. 概述

- 需求来源为不依赖外部lib库做准备，对    [libcrypto.so](http://libcrypto.so/)    .1.1库做动态加载，在不加载该库的情况下，部分数据库功能为可用状态


*SR:*    [YDBRD-23314](https://jira.yasdb.com/browse/YDBRD-23314?src=confmacro)    *-*  *【安全】动态加载openssl，安装包不自带*  *完成*

*开发设计文档：*    [dynamic load-crypto - 史鑫 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/display/~shixin/dynamic+load-crypto)  

# 2. 需求分析

## 2.1 功能点分析

- 不加载库的情况下，测试ssl功能
- 不加载库的情况下，登陆、yaspwd文件、ctl文件等为明文密码显示
- 不加载库的情况下，表空间加密不可用
- 默认为加载库，加载库的情况下，ssl功能，登陆、yaspwd文件、ctl文件等为密文显示，表空间加密可用
- 加载库和不加载库情况下，密文和明文文件情况交替使用


## 2.2 应用场景

- 需求旨在于解除外部库依赖，用于外部认证场景


## 2.3 规格约束

- 不加载库的情况下，登陆、yaspwd文件、ctl文件等为明文密码显示
- 加载库的情况下，ssl、表空间透明加密等功能正常使用


# 3. 详细测试设计

## 3.1 测试设计方法

  


1.场景法

2.边界值

3.等价类

4.错误推测法

## 3.2 详细测试设计

[动态加载openssl， 安装包不自带.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYjdhMWFkOWEzMzExZGM4NGZhIiwicmVmX2lkIjoiNjczOTZiYjc3MjgyMDZlZmI5MmYwOTVhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2NDc2LCJleHAiOjE3ODIzODI4NzZ9.bNzRNIn60-HTnD23UQ2_3c-bLhwqWjEyHquMcoc4DQs)

|细分模块|测试点|有效等价类|无效等价类|备注|  
|  
|  
|  
|  
|
|---|---|---|---|---|---|---|---|---|---|
|全是加载，无状态变更|ssl测试|功能正常使用|  
|  
|  
|  
|  
|  
|  
|
|  
|登陆测试|功能正常使用|  
|  
|  
|  
|  
|  
|  
|
|  
|yaspwd测试|生成加密的密码文件|  
|语法如：yaspwd file=yasdb.pwd password=Cod-2022|  
|  
|  
|  
|  
|
|  
|表空间透明加密测试|功能正常使用|  
|语法如：create tablespace export_import_tablespace_01 datafile '?/dbfiles/tbs_mms_wy1' size 10m ENCRYPTION ENCRYPT;|  
|  
|  
|  
|  
|
|  
|数据库正常open|可以正常open|  
|  
|  
|  
|  
|  
|  
|
|全是不加载，无状态变更|ssl测试|  
|无法使用该功能，报错|  
|  
|  
|  
|  
|  
|
|  
|登陆测试|正常登陆|  
|  
|  
|  
|  
|  
|  
|
|  
|yaspwd测试|生成明文密码,生成的密码可以正常登陆数据库|  
|  
|  
|  
|  
|  
|  
|
|  
|表空间透明加密测试|  
|报错不可用|  
|  
|  
|  
|  
|  
|
|  
|数据库能正常open|正常open|  
|  
|  
|  
|  
|  
|  
|
|初始建库状态是加载， 后面更改库状态为不加载|ssl测试|  
|更改为不加载后，ssl功能不可用|  
|  
|  
|  
|  
|  
|
|  
|登陆测试|重新生成pwd文件，正常登陆（此时根据库状态为不加载情况，生成密码为不加密的，与库状态一致，正常登陆）|pwd文件是加密情况下生成的，报错，无法连接（因为此时修改库状态为不加载，因此pwd文件密文形式与库不一致，报错）|  
|  
|  
|  
|  
|  
|
|  
|yaspwd|生成明文密码（不加载库情况下，生成明文密码）|  
|  
|  
|  
|  
|  
|  
|
|  
|表空间透明加密测试|  
|修改为不加载库，无法使用该功能，报错|  
|  
|  
|  
|  
|  
|
|  
|数据库起库|nomount可以正常起库|open报错（因为ctrl文件记录的数据文件是加密的，此时修改库为不加载状态，因此open起库报错）|  
|  
|  
|  
|  
|  
|
|初始建库状态是不加载， 后面更改库状态为加载 |ssl测试|更改为加载后，可用，功能正常|  
|  
|  
|  
|  
|  
|  
|
|  
|登陆测试|重新生成pwd文件，正常登陆（改库状态为加载情况，生成密文密码与库状态一致，因此能正常登陆）|pwd文件是不加密情况下生成的，报错，无法连接（此时库状态是加载情况，因此不加密文件与库状态不一致）|  
|  
|  
|  
|  
|  
|
|  
|yaspwd|生成密文密码（此时已修改库状态为加载库）|  
|  
|  
|  
|  
|  
|  
|
|  
|表空间透明加密|更改为加载后，可用，功能正常|  
|  
|  
|  
|  
|  
|  
|
|  
|数据库起库|nomount可以正常起库，不加载数据文件|open报错（因为ctrl文件记录的数据文件是未加密的，此时修改库为加载状态，因此库文件和ctrl文件记录的不一致，因此报错）|  
|  
|  
|  
|  
|  
|
|_CRYPTO_ENABLED=off |加载库|功能等同于全是加载情况|  
|  
|  
|  
|  
|  
|  
|
|  
|不加载库|功能等同于全是不加载情况|  
|  
|  
|  
|  
|  
|  
|
|_CRYPTO_ENABLED=on|加载库|功能等同于全是加载情况|  
|  
|  
|  
|  
|  
|  
|
|  
|不加载库|open起库报错|  
|  
|  
|  
|  
|  
|  
|
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|
|其他场景|系统表|用户密码以明文存储在系统表|  
|  
|  
|  
|  
|  
|  
|
|  
|jdbc|ssl测试、登陆测试|  
|  
|  
|  
|  
|  
|  
|
|  
|ldd检查程序无指向crypto库|  
|  
|  
|  
|  
|  
|  
|  
|
|  
|数据库不自带crypto库|  
|  
|  
|  
|  
|  
|  
|  
|


*2.梳理该特性是否涉DFX测试，并在详细设计中描述具体测试点，可借用xmind的方式*

|系统级DFX分类|是否涉及|
|---|---|
|CT|否|
|KT|否|
|长稳|否|
|一致性|否|
|三方测试工具    
  (sqltest，sqlancer)|否|
|安全|是|
|DFR|否|
|HA|否|
|压力|否|
|性能|否|
|可维护性|否|


  


# 4. 测试用例

1. 测试设计评审时提供冒烟文本用例；
1. 启动测试之前提供文本用例，并完成大部分自动化用例；


详见附件

# 5. 测试框架设计

- 在不加载的情况下需要删除这个库，ssh等对这个库都有依赖，无法自动化


# 6. 测试环境说明

*测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等*

# 7. 工作量评估

工作量：7  *人天*

计划测试完成时间：2024/1/8

[详细测试设计文档模板.doc](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYjdhMWFkOWEzMzExZGM4NGZiIiwicmVmX2lkIjoiNjczOTZiYjc3MjgyMDZlZmI5MmYwOTVhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2NDc2LCJleHAiOjE3ODIzODI4NzZ9.OywHv1pxxz3k83KiJoQ0h0J_QwnfiDotvjh7mvrWA_0)

## Attachments:

[详细测试设计文档模板.doc](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYjdhMWFkOWEzMzExZGM4NGZiIiwicmVmX2lkIjoiNjczOTZiYjc3MjgyMDZlZmI5MmYwOTVhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2NDc2LCJleHAiOjE3ODIzODI4NzZ9.OywHv1pxxz3k83KiJoQ0h0J_QwnfiDotvjh7mvrWA_0)

 (application/msword)    


[XXX功能测试设计.doc](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYjc4OTcwYzJhZjRmNTIwNjg1IiwicmVmX2lkIjoiNjczOTZiYjc3MjgyMDZlZmI5MmYwOTVhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2NDc2LCJleHAiOjE3ODIzODI4NzZ9.uSz5tA6Nt6sGxrwylPDLYljlVg8Cwp6_fpIn50R8_Lw)

 (application/msword)    


[动态加载openssl，安装包不自带.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYjdhMWFkOWEzMzExZGM4NGZjIiwicmVmX2lkIjoiNjczOTZiYjc3MjgyMDZlZmI5MmYwOTVhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2NDc2LCJleHAiOjE3ODIzODI4NzZ9.Jh5LznhLP0f0ObJh1gveedBiZFuJuRUJvUY1_bpg1B8)

 (application/x-xmind)    


[动态加载openssl， 安装包不自带.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYjdhMWFkOWEzMzExZGM4NGZhIiwicmVmX2lkIjoiNjczOTZiYjc3MjgyMDZlZmI5MmYwOTVhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2NDc2LCJleHAiOjE3ODIzODI4NzZ9.bNzRNIn60-HTnD23UQ2_3c-bLhwqWjEyHquMcoc4DQs)

 (application/x-xmind)    
