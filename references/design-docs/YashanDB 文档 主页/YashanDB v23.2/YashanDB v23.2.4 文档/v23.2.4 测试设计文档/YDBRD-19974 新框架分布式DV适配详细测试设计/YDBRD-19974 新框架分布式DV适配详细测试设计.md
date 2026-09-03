Created by 李世铭, last modified on 七月 03, 2024

# 1. 概述

在需求    [YDBRD-12300](https://jira.yasdb.com/browse/YDBRD-12300?src=confmacro)    -  集群支持全局动态视图  完成  中，于执行引擎内分离了fixed table和fixed view两个不同的对象，将旧有的动态视图更换成fixed_table + fixed_view的新框架实现。

本需求主要是分布式视图适配新的视图框架，视图语法上进行调整，并引入了权限控制：

1. 分布式视图框架调整
1. 分布式视图权限控制（grant select_catalog_role to user）
1. 视图语义重定义


# 2. 需求分析

SR：    [https://pingcode.yasdb.com/pjm/items/6660214d288e1978209cbb36](https://pingcode.yasdb.com/pjm/items/6660214d288e1978209cbb36)    ?    
  #YDBRD-28825 OM支持主备部署模式

设计文档：    [分布式DV$适配新视图架构设计文档](133569652.html)  

调研文档：    [YDBRD-16895 测试调研](https://conf.yasdb.com/pages/viewpage.action?pageId=135620538)  

## 2.1 功能点分析

1. 分布式视图框架调整
1. 分布式视图权限控制（grant select_catalog_role to user）
1. 不同视图在不同部署环境下的表现：


|部署模式|v$|gv$|x$|dv$|shards(v$)|
|:---|:---|:---|:---|:---|:---|
|单机|正常输出|正常输出|非sys用户无法查询|不支持|  
|
|集群|仅输出客户端连接节点数据|输出当前集群所有活节点数据（部分视图除外）|非sys用户无法查询，仅输出当前节点数据|不支持|  
|
|分布式|仅输出当前节点数据|输出当前集群所有活节点数据,（部分视图除外）|非sys用户无法查询，仅输出当前节点数据|保留|  
|


## 2.2 应用场景

无新增约束，能力与之前保持一致（    [YDBRD-6636：分布式支持dv$视图之间的join](https://conf.yasdb.com/pages/viewpage.action?pageId=112724817)    ）

## 2.3 约束

1. 不允许GV和DV关联
1. 不允许GV和用户视图用户表关联


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


**场景组合**

|类型|测试项|
|:---|:---|
|视图覆盖|覆盖所有涉及视图- 梳理所有dv$视图，根据已有用例构造对应场景，补充使用场景|
|  
|create table as select    ---不支持（因为不支持行表）|
|  
|insert into select     ----只支持插入CN本地系统表|
|  
|dv和gv的字段/字段描述/字段类型 一致|
|filter     覆盖|in/not in、exists/not exists、between and、like/not like|
|  
|distinct/order by/group by/group by...having/join on/  子查询  /union/union all|
|  
|cte查询|
|用户权限覆盖|sys用户查询gv,v,x可查|
|  
|dba用户查询gv,v可查,x不可查|
|  
|普通用户，gv,v,x不可查|
|  
|普通用户授权select_catalog_role，gv,v可查，x不可查|
|  
|授权select on gv$|
|  
|查询可以被审计|
|交互验证|扩容后新CN组 gv,v查询结果正确|
|  
|扩容后新DN组 v查询结果正确|
|  
|扩缩容期间查询gv   ---没有新增节点的数据|
|  
|升级之后查询|
|兼容性|DN/MN,gv查询  等同于V视图（带有node id gourp id instance id）|
|  
|单机分布式特有gv视图    查询结果为空|
|  
|集群分布式特有gv视图   查询结果为空|
|  
|gv与用户表用户视图join拦截|
|  
|gv与dv join拦截|


增加CT/KT用例

增加DFR背景

CN上只有OPEN阶段才可以查询视图，其他阶段查询报错   增加用例

查询gv是否在v$sql可查

在不同节点执行结果不同的表达式/函数用例覆盖

# 4. 测试用例

# 5. 测试框架设计

yasft测试框架

# 6. 测试环境说明

|IP|内存|磁盘空间|磁盘类型|CPU|操作系统|
|:---|:---|:---|:---|:---|:---|
|192.168.3.198|32G|700G|SSD|8核|centos7.0|
|192.168.3.140|32G|900G|SSD|8核|centos7.0|


# 7. 工作量评估

工作量：7  *人天*

计划测试完成时间：7/10

## Attachments:

[YDBRD-19974 新框架分布式DV适配文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkOWM4OTcwYzJhZjRmNTIxNDFhIiwicmVmX2lkIjoiNjczOTZkOWM1OTNmOTljOWZmMjM3ZDc5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEwMTcwLCJleHAiOjE3ODIzOTY1NzB9.gOu0pe5Qj1E0fkdJmykomeyd13FBptCNkFoYFGFPft0)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    
