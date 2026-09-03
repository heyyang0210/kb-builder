Created by 张欣, last modified on 七月 03, 2023

# 1.   **概述**

本文档描述    [支持st_Distance、ST_Length函数](https://jira.yasdb.com/browse/YDBRD-13292)    测试设计，SR    [YDBRD-13292](https://jira.yasdb.com/browse/YDBRD-13292?src=confmacro)    -  支持st_Distance、ST_Length函数  完成

# 2.   **需求分析**

**ST_Length**  (geometry a_2dlinestring);

ST_Length的作用是返回输入的  LineString, MultiLineString, LinearRing 子类型的长度，geometry计算2维的结果，  **geography计算时会计算Z坐标**  。

非LineString, MultiLineString的子类型返回0

geometry单位取决于入参的空间参考系类型：大地坐标（SRS_TYPE = GEOGRAPHIC2D,GEOGRAPHIC3D） 单位是经纬度；投影坐标，地心坐标等(PROJECTED，GEOCENTRIC，COMPOUND)单位是米。计算结果是double类型，单位一般都是米。

会校验srid的有效性，需要是spatial_ref_sys表中的有效srid，或者是0。

  


**ST_Distance**  (geometry g1, geometry g2);

ST_Distance的作用是返回两个geometry 的最小距离，也就是两个对象最近两个点的距离。

g1,g2都支持geometry的7种子类型。

结果单位和st_length一样取决于入参的空间参考系类型。

g1,g2 需要是基于相同的srid，且都是spatial_ref_sys表中的有效srid，或者是0。

# 3.   **测试设计方法**

场景分析，等价类

g1,g2是不同子类型及可能的特殊空间关系

|g1\g2|POINT|MULTIPOINT|LINESTRING|MULTILINESTRING|POLYGON|MULTIPOLYGON|GEOMETRYCOLLECTION|
|---|---|---|---|---|---|---|---|
|POINT|重合  （equal）|包含，g1是g2中一个点（  Contains）|点在线上（端点，中间的某个点）|/|点在多边形的内外边界内（  Contains）  、外(  Disjoint  )，,在边界上  （touch）  ；,  
|/|左边的几种情况组合|
|MULTIPOINT|  
|有重合的点|/|/|/|/|/|
|LINESTRING|  
|  
|线相交  （cross）  ；,重合  （equal）  ；,首尾相接；|/|和边界有相交  （cross）  ；,边界上某一点相交  （touch）  ；,和部分或全部边界重合|/|左边的几种情况组合|
|MULTILINESTRING|  
|  
|  
|/|/|/|/|
|POLYGON|  
|  
|  
|  
|g1在g2中包含（  Contains）；,g1,g2 部分相交（cross）；,重合（equal）；,有共同点，内部不相交（touch）|/|/|
|MULTIPOLYGON|  
|  
|  
|  
|  
|/|/|
|GEOMETRYCOLLECTION|  
|  
|  
|  
|  
|  
|组合覆盖前面列过的一些点|


# 4.   **详细测试设计**

1）使用章节3的测试方法设计详细的测试点，可沿用xmind的方式

2）梳理该特性是否涉各个专项测试，并在详细设计中描述具体测试点

|专项|是否涉及|
|:---|:---|
|并发|是|
|长稳|是|
|一致性|  
|
|三方测试工具    
  (sqltest，sqlancer)|  
|
|安全|  
|
|DFR/testkill|  
|
|HA|  
|
|压力|  
|
|性能|是|
|可维护性|  
|


# 5.   **测试用例**

测试设计细化后的文本用例

详见附件

# 6.   **测试框架设计**

1. 如果用例不能实现自动化需要在此标注并说明原因
1. 如果需要使用新的测试框架实现用例的自动化，需要在此说明测试框架的架构逻辑及详细设计
1. 如果沿用已有测试框架，需要在此标注测试框架的路径


# 7.   **测试环境说明**

测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等

## Attachments:

[ST_Length.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5NGFhMWFkOWEzMzExZGM3NTg5IiwicmVmX2lkIjoiNjczOTY5NGE1OTNmOTljOWZmMjM0Y2RmIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMTI2NTU5LCJleHAiOjE3ODIyMTI5NTl9.TgjwlTQ11DNzJTZXf4j0DNuWqtOwvdT7HjXIATVzKro)

 (application/x-xmind)    


[ST_Distance.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5NGFhMWFkOWEzMzExZGM3NThhIiwicmVmX2lkIjoiNjczOTY5NGE1OTNmOTljOWZmMjM0Y2RmIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMTI2NTU5LCJleHAiOjE3ODIyMTI5NTl9.6RhlKSTpfLuQq_hkE9TJVuKYvhT0f4rxAd-Eo36680Q)

 (application/x-xmind)    


[测试用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5NGE4OTcwYzJhZjRmNTFmNzEyIiwicmVmX2lkIjoiNjczOTY5NGE1OTNmOTljOWZmMjM0Y2RmIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMTI2NTU5LCJleHAiOjE3ODIyMTI5NTl9.CLncOgbciI_L1hJLclZh9c7MOICh8MLERAaamesH2iY)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    
