Created by 李美娥, last modified on 十一月 07, 2023

1. 参考资料

        需求：    [YDBRD-13302](https://jira.yasdb.com/browse/YDBRD-13302?src=confmacro)    -  支持ST_SetSRID函数  完成

        开发设计：    [ST_SetSrid Analyse - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/display/YAS/ST_SetSrid+Analyse)  

        对外提供的函数：ST_SetSRID

        函数目前支持的类型：Point、LineString、Polygon、 MultiPoint、MultiLineString、 MultiPolygon、GeometryCollection类型

  


2.   **需求分析**

对功能/需求进行详细说明及分析，包括但不限于需求涉及的规格、约束，主要业务场景，系统/模块上下文等

函数功能  ：将几何体上的SRID设置为特定的整数值，坐标值不变化，返回已经设置好Srid的Geometry（本身入参geom的srid不变化–比如geom是表里面的数据，函数处理后，表里面数据的geom还是原有的srid  ，  SRID值不存在表spatial_ref_sys也不会报错），  验证仅srid信息变更st_srid或者st_ewkb，其坐标信息不变化st_astext。

  


3.   **测试设计方法**

等价类，边界值，场景分析。

|编号|geomA|srid|return|
|:---|:---|:---|:---|
|1|  
  1、7种子类型，数据含empty、 nan等、是null 、‘’,2、入参类型不合法,3、不带srid（默认0）和带srid|（1）srid数据的范围,有效等价类：,1、正整数（在spatial_ref_sys里面，不在spatial_ref_sys里面，1999-比最小值小、5000--中间的值、1000000--比最大值大）,2、负数,3、0,4、隐式转换,5、特殊值null 、'',无效等价类：,6\超过int类型、其他不能转为Int的类型,（2）场景,1、投影坐标-》投影坐标（srid一致，srid不一致）,2、投影坐标-》大地坐标,3、大地坐标-》投影坐标,4、大地坐标-》大地坐标（srid一致，srid不一致）,5、与  ST_Transform、ST_Boundary、ST_Envelope、其他返回值为geom类型的函数的结合测试–返回时geom,入参是geom。|（1）,1、在spatial_ref_sys里面的返回对应的值  ，  超过的是超过的值（跟pg保持不一致）,2、0,3、0,4、支持浮点数、boolean、字符,5、null,6、报错,（2）成功|
|2|内置函数的其他测试点,与dml、查询、plsql结合使用的场景、入参个数、自嵌套、函数关键字等||  [*内置函数测试设计checklist](https://conf.yasdb.com/pages/viewpage.action?pageId=76929071)  |


  


# 4.   **详细测试设计**

1）使用章节3的测试方法设计详细的测试点，可沿用xmind的方式

函数的测试点本质同内置函数，参考    [*内置函数测试设计checklist - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=76929071)    的测试点，进行设计。

  


2）梳理该特性是否涉各个专项测试，并在详细设计中描述具体测试点

|专项|是否涉及|
|:---|:---|
|并发|否|
|长稳|否|
|一致性|否|
|三方测试工具    
  (sqltest，sqlancer)|否|
|安全|否|
|DFR/testkill|否|
|HA|否|
|压力|否|
|性能|否|
|可维护性|否|


# 5.   **测试用例**

测试设计细化后的文本用例  电

子表格

# 6.   **测试框架设计**

1. 如果用例不能实现自动化需要在此标注并说明原因
1. 如果需要使用新的测试框架实现用例的自动化，需要在此说明测试框架的架构逻辑及详细设计
1. 如果沿用已有测试框架，需要在此标注测试框架的路径


# 7.   **测试环境说明**

测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等

# **8. 差异点记录**

  


## Attachments:

[image2023-5-24_17-24-35.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5NGJhMWFkOWEzMzExZGM3NTkzIiwicmVmX2lkIjoiNjczOTY5NGI3MjgyMDZlZmI5MmVmMWEyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMTI2NTkzLCJleHAiOjE3ODIyMTI5OTN9._tJnatqWrWaxQqttnMbgrE7jA8jEtodQ30aQxW1Sdj8)

 (image/png)    


[st_setsrid.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5NGI4OTcwYzJhZjRmNTFmNzFkIiwicmVmX2lkIjoiNjczOTY5NGI3MjgyMDZlZmI5MmVmMWEyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMTI2NTkzLCJleHAiOjE3ODIyMTI5OTN9.gzbrqbgOdnpY73Ch_6EcGItQbeG4niF_7NV3cXhKnXo)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[st_setsrid.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5NGI4OTcwYzJhZjRmNTFmNzFlIiwicmVmX2lkIjoiNjczOTY5NGI3MjgyMDZlZmI5MmVmMWEyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMTI2NTkzLCJleHAiOjE3ODIyMTI5OTN9.gubyNCCPcowEbwYVX_o7v17nBksFn8PXHMu5mFP2dnE)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    
