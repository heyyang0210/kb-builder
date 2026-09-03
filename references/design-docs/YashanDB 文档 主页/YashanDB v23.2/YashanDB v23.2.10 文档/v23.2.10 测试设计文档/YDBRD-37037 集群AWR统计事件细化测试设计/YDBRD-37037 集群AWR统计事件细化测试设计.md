# 1. 概述

本文描述 集群AWR统计事件细化 测试设计。

SR: 

  [https://pingcode.yasdb.com/pjm/items/67723be8a9f31a27f6b0f75b](https://pingcode.yasdb.com/pjm/items/67723be8a9f31a27f6b0f75b)  ?  
#YDBRD-37037 【DFX】集群AWR统计事件细化

# 2. 需求分析

## 2.1 功能点分析

集群AWR统计事件细化。

部署形式：单机、集群。

## 2.2 应用场景

需求场景：

1. **Y**  **AC Report Summary 统计相关数据单位不明确的问题，需要标注补齐;**
1. 单机AWR：  **VM情况+**  Report Summary--缓存信息补充;


## 2.3 规格约束

|场景名称|规格约束|特性是否涉及|
|---|---|---|
|Y  AC Report Summary 统计相关数据单位不明确的问题|补齐相关单位(具体单位暂未给出)|是|
|AWR报告补充VM情况信息|只补充行存的信息(统计第二个快照的VM)|是|
|Report Summary--缓存信息补充|补充V$SGA展示所有的信息(统计第二个快照的信息)|是|




# 3. 详细测试设计

## 3.1 测试设计方法

*对本测试设计中使用的工程方法及适用的场景分类做说明，如常用的边界值，等价类，流程图及相关的组合策略*

主要采用等价类划分、场景法组合进行设计。

## 3.2 详细测试设计

1. *使用章节3.1的测试方法设计详细的功能测试点，可借用xmind的方式*
1. *梳理该特性是否涉DFX测试，并在详细设计中描述具体测试点，可借用xmind的方式*


|等价类|有效类|备注|无效类|备注|
|---|---|---|---|---|
|部署方式|- 单机
- 集群
||- 分布式
||
|表类型|- heap
- tac
- lsc
|VM只补充行存的信息，列存表简单覆盖|||
|awr两个快照之间操作|- 无操作
- ddl
- dml
||||




### 3.2.1   **Y**  **AC Report Summary 统计相关数据单位明确**

**注：需要测试数值是否合理**

**相关视图：v$sysstat，SYS.wrh$_sysstat  **

**结果值：两次快照差值**

YAC SYS STATS单位详情:  [  https://pingcode.yasdb.com/wiki/spaces/LEISHIZHU/pages/6791e3ded06ac74ecc3fc0e5](https://pingcode.yasdb.com/wiki/spaces/LEISHIZHU/pages/6791e3ded06ac74ecc3fc0e5)  

![clipbord_1737613921509.png](https://pingcode.yasdb.com/atlas/files/public/67a6bddf98ac295b69be0b6d/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFnQUFBQUFBQUFBQUFBQUJRQUFBQUFBQUFBQUFRQUFBQUFBQUFBQUFnQUVBQUFBQUFBQ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBRUlBQUFBQUVBZ0FBQUFBQUFBQUFBQUFBRVFBQUFBQUFBQUFBQkFDQUFBQUFBQUJBQUFBQUFBQUFBQUFBQUFBRUFBQUFBUUFBQUFBQUFBZ0FBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzNDE2MzAsImV4cCI6MTc4MjM1MjQzMH0.WeD0OF1ws0O8HIedOwy56Fmr897iVu1imgRd-2BmOX4)

![image.png](https://pingcode.yasdb.com/atlas/files/public/6791ade398ac295b69be0aa3/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFnQUFBQUFBQUFBQUFBQUJRQUFBQUFBQUFBQUFRQUFBQUFBQUFBQUFnQUVBQUFBQUFBQ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBRUlBQUFBQUVBZ0FBQUFBQUFBQUFBQUFBRVFBQUFBQUFBQUFBQkFDQUFBQUFBQUJBQUFBQUFBQUFBQUFBQUFBRUFBQUFBUUFBQUFBQUFBZ0FBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzNDE2MzAsImV4cCI6MTc4MjM1MjQzMH0.WeD0OF1ws0O8HIedOwy56Fmr897iVu1imgRd-2BmOX4)

### 3.2.2  VM信息补充

新创建一个标签Memory Statistics，里面添加VM信息，只统计行存,显示结果为第二个快照的VM。

![image.png](https://pingcode.yasdb.com/atlas/files/public/6791ad2e98ac295b69be0aa0/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFnQUFBQUFBQUFBQUFBQUJRQUFBQUFBQUFBQUFRQUFBQUFBQUFBQUFnQUVBQUFBQUFBQ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBRUlBQUFBQUVBZ0FBQUFBQUFBQUFBQUFBRVFBQUFBQUFBQUFBQkFDQUFBQUFBQUJBQUFBQUFBQUFBQUFBQUFBRUFBQUFBUUFBQUFBQUFBZ0FBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzNDE2MzAsImV4cCI6MTc4MjM1MjQzMH0.WeD0OF1ws0O8HIedOwy56Fmr897iVu1imgRd-2BmOX4)

![image.png](https://pingcode.yasdb.com/atlas/files/public/6791ad6b98ac295b69be0aa1/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFnQUFBQUFBQUFBQUFBQUJRQUFBQUFBQUFBQUFRQUFBQUFBQUFBQUFnQUVBQUFBQUFBQ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBRUlBQUFBQUVBZ0FBQUFBQUFBQUFBQUFBRVFBQUFBQUFBQUFBQkFDQUFBQUFBQUJBQUFBQUFBQUFBQUFBQUFBRUFBQUFBUUFBQUFBQUFBZ0FBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzNDE2MzAsImV4cCI6MTc4MjM1MjQzMH0.WeD0OF1ws0O8HIedOwy56Fmr897iVu1imgRd-2BmOX4)

### 3.2.3 Report Summary 缓存信息补充

#### 展示V$SGA所有的信息即可:

data buffer                                 

temporary buffer                         

large pool                                 

redo buffer                                    

hot cache                               

share pool                               

global application pool                

dbwr buffer                                 

job pool                                      

parallel execute buffer                  

audit queue buffer   



# 4. 测试用例

1. 测试设计评审时提供冒烟文本用例；
1. 启动测试之前提供文本用例，并完成大部分自动化用例；


详见附件

# 5. 测试框架设计

- *如果用例不能实现自动化需要在此标注并说明原因*
- *确认使用的测试框架及其满足度*


# 6. 测试环境说明

*测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等*

# 7. 工作量评估

工作量：  *xx人天*

计划测试完成时间：



