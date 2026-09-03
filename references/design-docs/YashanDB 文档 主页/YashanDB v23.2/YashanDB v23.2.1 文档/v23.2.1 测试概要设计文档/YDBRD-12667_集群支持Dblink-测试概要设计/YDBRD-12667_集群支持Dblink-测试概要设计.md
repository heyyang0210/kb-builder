Created by 孟麟, last modified on 十一月 02, 2023

# YDBRD-12667 测试概要设计

IR链接：    [YDBRD-12667](https://jira.yasdb.com/browse/YDBRD-12667?src=confmacro)    -  集群支持Dblink  完成

## 1. 需求概述

集群支持的dblink能力与单机一致；开发的主要工作是集群管理适配

## 2. 功能点

1、功能点包括：元数据管理（DDL）、视图、DML操作含insert select，查询、导入导出、权限和审计

2、对于集群，存在多实例，使用yasql连接时指定ip和端口连接到某个实例，连接上后上述功能点同单机；需要新增(额外)考虑的是实例间：

（1）支持元数据在实例间同步，A实例上创建DBLink，其他实例也能够查询并使用这个DBLink

（2）实例间并发控制和冲突处理，多个实例同时创建相同DBLink

3、新增集群部署形态，访问模式上在（Y单机->Y单机，Y单机->O）基础上新增：Y集群->Y集群，Y集群->Y单机，Y集群->O，Y单机->Y集群 

## 3. 规格约束

同单机（待梳理补充单机的规格约束）

## 4. 主要应用场景

Database Link即数据库链接，通过在本地数据库创建一个指向对方数据库的link，用户可以像访问本地数据库一样访问其他数据库的数据，实现了跨数据库的访问。

目前单机YashanDB支持Y->Y，Y<->O的DBLink；YashanDB集群支持DBLink功能后，支持：Y集群->Y集群，Y集群->Y单机，Y集群->O，Y单机->Y集群 这些访问模式的DBLink

![](https://conf.yasdb.com/download/attachments/133573307/image2023-10-24_20-18-3.png?version=1&modificationDate=1698149635000&api=v2?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTQ0ODUsImV4cCI6MTc4MjMwNTI4NX0.MXTzL1m3B6555NiGWy80Z0Y1kyR6yuPgzADfN9xQtD4)

## 5. 概要测试设计

### 5.1 功能测试设计

1、dblink功能点继承单机

2、针对集群，新增覆盖：

（1）集群多实例间，元数据同步和并发冲突场景

（2）新增访问模式：  Y集群->Y集群，Y集群->Y单机，Y集群->O，Y单机->Y集群，分析差异，确定等价类，同一等价类中确定一种典型验证场景，其他场景覆盖基本功能(确保功能可用)

### 5.2 DFX测试设计

1、CT/KT：继承单机，差异点：多实例KT

2、可靠性：多实例间dblink元数据同步（create/alter/drop与节点故障场景）

3、长稳：继承单机，差异点：适配多实例，在多实例上操作元数据和使用dblink

4、其他：不涉及

## 6. 测试策略

1、测试设计：分析集群上差异点，对于继承单机的功能点无差异的，不再做测试设计且继承测试用例，针对集群差异点（dblink功能差异和集群本身特性差异）进行测试设计，输出测试用例并执行

2、自动化：需要适配修改，功能框架：支持部署2个集群（类似单机），CT/KT、长稳：部署和执行SQL（类似单机方式适配）

3、可维可测：无（已满足）

## 7. 后续关注(可选)

*依赖特性识别*

*后续测试详细设计中需要关注的内容*