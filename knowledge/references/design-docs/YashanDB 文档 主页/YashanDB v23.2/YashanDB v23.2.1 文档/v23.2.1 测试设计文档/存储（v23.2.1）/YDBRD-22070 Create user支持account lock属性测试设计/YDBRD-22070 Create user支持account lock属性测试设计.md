Created by 卢凯舜, last modified on 十一月 20, 2023

# 1. 概述

支持在创建用户的同时锁定用户。  account lock状态用户登录报错

# 2. 需求分析

## 2.1 功能点分析

- *可以通过创建时指定 account lock，让用户无法登录*
- *可通过dba_users查看ACCOUNT_STATUS*


*语法图*

***create user::=***

```
<span class="token rule">syntax</span>::<span class="token operator" style="color: rgb(103,205,204);">=</span> <span class="token rule">CREATE USER user_name</span> <span class="token punctuation" style="color: rgb(204,204,204);">[</span><span class="token rule">IDENTIFIED BY</span> <span class="token punctuation" style="color: rgb(204,204,204);">[</span><span class="token rule">VALUES</span><span class="token punctuation" style="color: rgb(204,204,204);">]</span> <span class="token rule">password</span><span class="token punctuation" style="color: rgb(204,204,204);">]</span>
<span class="token punctuation" style="color: rgb(204,204,204);">[</span><span class="token rule">DEFAULT TABLESPACE tablespace</span><span class="token punctuation" style="color: rgb(204,204,204);">]</span>
<span class="token punctuation" style="color: rgb(204,204,204);">[</span><span class="token rule">PROFILE profilename</span><span class="token punctuation" style="color: rgb(204,204,204);">]
[account lock|unlock]

</span>
```

sr：    [YDBRD-22070](https://jira.yasdb.com/browse/YDBRD-22070?src=confmacro)    -  Create user支持account lock属性  完成

开发设计文档：    [YDBRD-22070 create user account lock - 张志鹏 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/display/~zhangzhipeng/YDBRD-22070+create+user+account+lock)  

交付形态：单机、分布式、集群

## 2.2 应用场景

- *创建时指定*  * lock/unlock，决定创建的用户是否能够登录*
- *不指定默认为unlock*


## 2.3 规格约束

- 设置为lock之后也需要分配dba权限才能登录


# 3. 测试设计方法 

## 3.1 测试设计方法

*对本测试设计中使用的工程方法及适用的场景分类做说明，如常用的边界值，等价类，流程图及相关的组合策略*

*如：内置函数入参–边界值；等价类*

*语法图–路径覆盖*

## 3.2 详细测试设计

*1)使用章节3.1的测试方法设计详细的功能测试点，可借用xmind的方式*

*语法*

|输入条件||有效等价类|编号|无效等价类|编号|
|:---|---|:---|:---|:---|:---|
|  ` [IDENTIFIED BY [VALUES] password]`  |  
|带密码|  
|  
|  
|
|  
|  
|不带密码|  
|  
|  
|
|  `[DEFAULT TABLESPACE tablespace]`  |  
|带默认表空间|  
|  
|  
|
|  
|  
|不带默认表空间|  
|  
|  
|
|  `[PROFILE profilename]`  |  
|带  profile|  
|  
|  
|
|  
|  
|不带  profile|  
|  
|  
|
|[account lock|unlock]|  
|正确字段输入|  
|字段拼写错误|  
|
|  
|  
|默认值|  
|字段重复|  
|
|  
|  
|字段大小写|  
|字段缺失|  
|


场景测试 验证带该选项的登录情况，并  通过dba_users查看ACCOUNT_STATUS

|序号|测试场景||预期|备注|
|:---:|:---:|---|:---:|:---:|
|  
|设置为  lock|  
|登录失败|  
|
|  
|设置为un  lock，不分配权限|  
|登录失败|  
|
|  
|设置为unlock，分配权限|session权限|登录成功|  
|
|  
|  
|dba权限|登录成功|  
|
|  
|设置为  lock后，alter user解锁|  
|登录成功|  
|
|  
|设置为lock后，alter user 锁住|  
|登录失败|  
|
|  
|校验其他选项错误场景|  
|  
|  
|
|  
|修改为本身属性|  
|  
|  
|
|  
|并发创建用户|  
|  
|  
|
|  
|并发创建用户+修改用户|  
|  
|  
|


*2)*  *梳理该特性是否涉DFX测试，并在详细设计中描述具体测试点，可借用xmind的方式*

|系统级DFX分类|是否涉及|
|:---|:---|
|CT|是|
|KT|  
|
|长稳|  
|
|一致性|  
|
|三方测试工具    
  (sqltest，sqlancer)|  
|
|安全|  
|
|DFR|  
|
|HA|  
|
|压力|  
|
|性能|  
|
|可维护性|  
|


# 4. 测试用例

1. 测试设计评审时提供冒烟文本用例；
1. 启动测试之前提供文本用例，并完成大部分自动化用例；


详见附件

# 5. 测试框架设计

- *如果用例不能实现自动化需要在此标注并说明原因*
- *确认使用的测试框架及其满足度*


# 6. 测试环境说明

*测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等*

|服务器|  
|
|:---|:---|
|操作系统|Linux|
|部署|  
|


# 7. 工作量评估

工作量：  *xx人天*

计划测试完成时间：

## Attachments:

[文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiZTRhMWFkOWEzMzExZGM4NjUyIiwicmVmX2lkIjoiNjczOTZiZTQ3MjgyMDZlZmI5MmYwYjNjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk3NjM2LCJleHAiOjE3ODIzODQwMzZ9.otaXlqzn5hoA2Mb2za0Ijfgzyx6biA5vApmgqn0n5-0)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    
