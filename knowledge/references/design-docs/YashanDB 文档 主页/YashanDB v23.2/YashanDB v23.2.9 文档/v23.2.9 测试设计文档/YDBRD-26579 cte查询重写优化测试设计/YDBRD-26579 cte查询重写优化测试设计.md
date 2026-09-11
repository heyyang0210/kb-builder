Created by 马文英, last modified on 七月 12, 2024

# 1. 概述

CTE多次访问时对CTE进行物化只执行一次可访问多次

# 2. 需求分析

## 2.1 功能点分析

- *CTE语法 没有改变，使用当前语法*


![](https://pingcode.yasdb.com/atlas/files/public/6739c3b28970c2af4f536984/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBSUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUVBUUFBQUFBQUFBQUFBZ0FBSUFBQUFBQUFBQWdBQUFBQUFBQUVBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBSUFBQUFBQUFBQUFBQUFBQUFJQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMjQxNjUsImV4cCI6MTc4MjMzNDk2NX0.S3fG0LklTQSsgGzo731vj1L7HGjff7HXS121rxqqXGo)

*目前实现：CTE作为inline的subquery，多次访问时，需要单独执行。*

优化重写：CTE可以物化为临时表，可以通过table access 算子访问，定义CTE的子查询只需要执行一次；物化和inline两种方式根据cost进行选择。

                   物化重写可以通过隐藏参数进行控制打开和关闭。

                   物化CTE时：1. 临时表的列可以是CTE定义的所有列，或者只包含访问时用到的列，本次实现物化定义CTE的所有列

                                        2. CTE物化前可以参与主查询的优化，本次实现支持把谓词推到CTE里面，再物化CTE (  白名单谓词可下推，  )

                                        3. 查询中多次访问CTE可物化时，存在三种执行场景；

                                                  3.1 沿用当前的方式，全部inline方式；3.2 全部访问物化的CTE； 3.3 部分访问物化CTE，部分inline；

                                        4. 不支持递归CTE的物化；（transformation）

  


待确认  ：不访问的CTE是否做物化和语法检查 (verify ),    触发式执行

## 2.2 应用场景

- CTE本身执行时间较长，多次访问时耗时成倍增加，物化后可以提高查询的性能；


## 2.3 规格约束

- 递归CTE不支持物化
- 只支持单机行执行
- 分布式行表不支持（DEV合入后SIT检查一下）
- 是否根据cost选 ？


# 3. 详细测试设计

## 3.1 测试设计方法

*对本测试设计中使用的工程方法及适用的场景分类做说明，如常用的边界值，等价类，流程图及相关的组合策略*

*如：内置函数入参–边界值；等价类*

*语法图–路径覆盖*

  


*场景-边界值-等价类*

## 3.2 详细测试设计

1. 一下测试点没有特殊说明均可构造出可物化场景


|场景|测试点|测试点特征|备注|
|---|---|---|---|
|物化的CTE|CTE列的个数|1 ~ 4096|和现有CTE保持一致,单行64K/256K|
||物化数据量的大小|全内存|8M 使用预留,>8M 多级页面 256T,  
|
||  
|需要换入换出|PQ_POOL|
||  
|  
|  
|
||列的数据类型|数值，字符，日期，大对象，自定义类型。。。|根据文档补充|
||绑定参数|CTE定义中有绑定参数|  
|
||  
|访问CTE的条件有绑定参数|  
|
|物化CTE的使用|包含一个CTE|CTE访问0次|不访问的CTE不物化|
||  
|CTE访问一次|  
|
||  
|CTE访问两次|  
|
||  
|CTE访问多次|比如10次|
||访问CTE的位置|投影列标量子查询| 访问位置分单独出现场景 和 组合出现场景|
||  
|FROM 后直接访问|  
|
||  
|FROM 后子查询中|  
|
||  
|where 条件中子查询|in,   exists子查询里面有CTE访问，提前终止场景,exists(select * from cte1 t1, cte1 t2),with cte1 (select * from t where a <1),select * from cte1 t1, cte1 t2;,select * from cte1 where exists(select * from cte1 where cte1.c1 <0) and cte1.c1 <0|
||  
|集合操作的两个分支|  
|
||结合其他物化算子使用|聚集函数|算子组合可组合测试|
||  
|hash join （anti,semi）|CTE访问提前终止场景|
||  
|merge join|  
|
||  
|窗口函数|  
|
||  
|connect by|  
|
||包含多个CTE|多个CTE分别只访问一次|场景可组合|
||  
|多个CTE部分访问多次|  
|
||  
|多个CTE全部访问多次|  
|
||  
|CTE2 访问CTE1 多次|  
|
||  
|CTE3 访问CTE2多次；CTE2 访问CTE1 多次|  
|
||  
|部分CTE不被访问|不访问的CTE不物化,(显示不访问，数据流程走不到)|
||  
|可物化CTE的个数|1 ~ 50个|
||user view|使用可物化的CTE定义用户视图|所有CTE都被访问,部分CTE被访问|
||DML|出现在DML可使用子查询的地方|谓词 in / exists / any / all ...|
||TEMP TAB ACCESS|并行|cte访问的表并行扫|
|物化CTE结合已有优化项|谓词下推|每个访问都有谓词可下推|  
|
||  
|部分访问有谓词可下推|  
|
||  
|每个访问可下推的谓词不一样|  
|
||  
|  
|  
|
||group by 下推|  
|不支持|
||order by 下推|  
|不支持|
||  
|  
|  
|
|可维护性（配置参数测试）|*_with_subquery*|materialize（一定物化）|验证可物化场景,验证根据cost没有物化的场景|
||  
|inline（不物化）|验证根据cost可物化场景变为不可物化|
||  
|optimize（可物化）|默认值 根据cost|
|性能测试 （单算子性能）|  
|增加单算子性能看护用例|  
|
|CT|  
|挑选典型场景，补充并发工程用例|单个CTE,多个CTE,数据类型|
|sqlsmith|  
|增加配置参数测试  materialize的执行场景|  
|
|  
|  
|  
|  
|
|单机列存|  
|补充一个在行存下可物化的用例|列存下不报错，不物化|
|分布式行存|  
|补充一个单机行存可物化的用例|分布式不报错， 不物化|
|  
|  
|  
|  
|


1. *梳理该特性是否涉DFX测试，并在详细设计中描述具体测试点，可借用xmind的方式*


|系统级DFX分类|是否涉及|备注|
|:---|:---|---|
|CT|是|涉及物化区，增加并发用例|
|KT|是|涉及物化区，增加KT用例|
|长稳|是|增加长稳用例，防止内存泄漏|
|一致性|否|-SQL 优化特性不涉及|
|三方测试工具    
  (sqltest，sqlancer)|是|-基础语法已有，不需要新增|
|安全|否|-没有新增语法，不涉及|
|DFR|否|-没有新增语法，不涉及|
|HA|否|-没有新增语法，不涉及|
|压力|否|-没有新增语法，不涉及|
|性能|是|CTE物化后单算子性能的看护|
|可维护性|是|CTE物化开关|


  


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

## Attachments:

[image2024-7-3_9-57-56.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOWMzYjJhMWFkOWEzMzExZGRlN2QwIiwicmVmX2lkIjoiNjczOWMzYjI3MjgyMDZlZmI5MzEwZDUwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzI0MTY1LCJleHAiOjE3ODI0MTA1NjV9.qIsuF6BQhtpwf3Q3k60cLK8JW7sQDrt7fwZBtG_zKdE)

 (image/png)    


[image2024-7-3_9-59-18.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOWMzYjI4OTcwYzJhZjRmNTM2OTgyIiwicmVmX2lkIjoiNjczOWMzYjI3MjgyMDZlZmI5MzEwZDUwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzI0MTY1LCJleHAiOjE3ODI0MTA1NjV9.bUV6jaUHxdH7dd2q4YzFeUncCNaBdU4vtfwWvevCcBs)

 (image/png)    


## Comments:

|  [](null)  ,1. user view的共享cte不参与优化 
,  [https://pingcode.yasdb.com/pjm/items/6708d653e489dd0868f4e957](https://pingcode.yasdb.com/pjm/items/6708d653e489dd0868f4e957)    ? #YDBRD-33916 【CTE】CTE用例并发时偶现 core ankCloseDict,![](https://pingcode.yasdb.com/atlas/files/public/6739c3b2a1ad9a3311dde7d2/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBSUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUVBUUFBQUFBQUFBQUFBZ0FBSUFBQUFBQUFBQWdBQUFBQUFBQUVBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBSUFBQUFBQUFBQUFBQUFBQUFJQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMjQxNjUsImV4cCI6MTc4MjMzNDk2NX0.S3fG0LklTQSsgGzo731vj1L7HGjff7HXS121rxqqXGo),Posted by mawenying at 十一月 14, 2024 10:21|
|---|


