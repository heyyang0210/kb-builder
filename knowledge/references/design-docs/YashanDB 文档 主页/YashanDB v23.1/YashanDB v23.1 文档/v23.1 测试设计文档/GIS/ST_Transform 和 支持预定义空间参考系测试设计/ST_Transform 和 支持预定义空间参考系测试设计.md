Created by 张欣, last modified on 十一月 07, 2023

# 1.   **概述**

简要说明本功能/需求的背景，本文档的适用范围

支持预定义空间参考系     [YDBRD-13294](https://jira.yasdb.com/browse/YDBRD-13294?src=confmacro)    -  支持预定义空间参考系  完成

支持ST_Transform函数     [YDBRD-15251](https://jira.yasdb.com/browse/YDBRD-15251?src=confmacro)    -  支持ST_Transform函数  完成

# 2.   **需求分析**

1. 新增系统表  spatial_ref_sys 记录数据库支持的 SRID，引用EPSG标准，和postgis保持一致；支持缓存空间参考系。
1. ST_Transform 函数，用于将输入的geometry数据转换成另一个指定坐标系下的数据，输出仍是geometry. 语法如下：


          geometry   **ST_Transform**  (geometry g1, integer srid);  

测试思路：

## 支持预定义空间参考系

1.检查系统表spatial_ref_sys ，字段名称，内容，资料描述；内容对比postgis。SRS_TYPE 是新增字段，记录坐标系类型。

2.功能实现检查，排查和沿用历史功能用例srid的生效情况。上车跑全量；有些特性构造数据未考虑srid的补充一些数据和用例。

|  
|函数分类|是否涉及|
|---|---|---|
|迭代一|输入输出函数|否，构造数据时会使用|
|迭代二|属性访问|否，不涉及坐标系转换|
||空间关系|否，空间关系都是基于相同的坐标系。排查下历史用例是否有覆盖不同的坐标系|
||处理函数,buffer,ST_GeometricMedian   ,ST_Simplify|涉及，排查和扩充用例，覆盖不同的坐标系类型|
||构造函数|否，构造数据时会使用|
|迭代三|叠加分析|否，在构造数据时覆盖不同的坐标系|
|  
|  
|  
|


## ST_Transform 函数

1.数据类型：覆盖当前支持的geometry子类型。

2.坐标内容：考虑geometry和geography 两种坐标系支持的坐标范围不同，可能出现不支持转换； 特殊值：empty，nan，inf, 0 0 等

3.srid 

分类两种：  geometry和geography； 同个大类转换，不同大类转换；

to_srid和from_srid 的分类组合，需要都是有效的。

|  
|from_srid|to_srid|
|---|---|---|
|有效等价类|spatial_ref_sys 中记录的srid|spatial_ref_sys 中记录的srid|
|||可以转成有效srid的小数（四舍五入）、字符串、其他数据类型|
|无效等价类    
    
    
|0|0,负数（转成0）|
||~~特殊值 NULL~~|特殊值 NULL|
||不在spatial_ref_sys 中记录的srid|不在spatial_ref_sys 中记录的srid,超过int边界值|
|||准换后不是有效srid的小数（四舍五入）、字符串,不能转换的数据类型|


重点覆盖的转换的srid的范围：中国，（没有广东省 或 深圳市 专有的srid） 主要城市：北京，上海，西安，香港等。 GPS使用的坐标系- 4326

|  
|  
|说明|type|单位 和 预计范围|
|---|---|---|---|---|
|国际|**4326**|WGS84 是目前最流行的地理坐标系统，GPS是基于WGS84的。|GEOGRAPHIC2D  大地坐标|经纬度,-180.0 -90.0    
  180.0 90.0|
||4327|  
|GEOGRAPHIC3D 大地坐标|经纬度|
||**3857**|用于在谷歌地图、OpenStreetMap 等|PROJECTED   投影坐标系|米 ,-20037508.34 -20048966.1 20037508.34    
  20048966.1|
|国内,  
,  
    
|**4490**|中国大地坐标系2000,天地图用的中国2000|GEOGRAPHIC2D 大地坐标|经纬度,73.62 16.7    
  134.77 53.56|
||**4479**|中国大地坐标系2000|GEOCENTRIC   大地坐标，地心参考系|米 ,-4303616.48 2695444.42    
  1723289.26 6110730.09|
||**4480**|中国大地坐标系2000|GEOGRAPHIC3D 大地坐标|经纬度,73.62 16.7    
  134.77 53.56|
||**4508**|中国大地坐标系2000|PROJECTED   投影坐标|经纬度,108.0 16.7 ,114.0   45.11,179915.67 1847106.87 ,820084.33 5001549.83|
||**4509**|中国大地坐标系2000|PROJECTED   投影坐标|经纬度,114.0 19.02    
  120.0 51.52,184047.25 2103881.96    
  815952.75 5714206.25|
||2349|  [西安1980](https://epsg.io/4610)  |PROJECTED   投影坐标系|米 ,25375272.44 3964464.3    
  25635574.19 4502789.7|


  [meethigher-Gis坐标系4326与3857及高德百度坐标系转换_3857坐标系_言成言成啊的博客-CSDN博客](https://blog.csdn.net/qq_30460361/article/details/124917317?spm=1001.2101.3001.6661.1&utm_medium=distribute.pc_relevant_t0.none-task-blog-2%7Edefault%7ECTRLIST%7ERate-1-124917317-blog-127420442.235%5Ev38%5Epc_relevant_sort&depth_1-utm_source=distribute.pc_relevant_t0.none-task-blog-2%7Edefault%7ECTRLIST%7ERate-1-124917317-blog-127420442.235%5Ev38%5Epc_relevant_sort&utm_relevant_index=1)  

4326-3857 转换较多

深圳的经纬度范围：   **东经­113°46'～114°37'，北纬22°27'～22°52'，**  适用的中国2000坐标系为  **4508，4509**

4.验证方式：

转换后输出坐标的结果正确性，对比postgis；

转换后的srid,st_srid 函数可验证。

转换后的geometry再参与运算：1）  ST_Transform    转回原来的srid、继续转换；2）计算空间关系（srid一致），叠加分析等；3）处理函数，属性访问等

转换失败的几种情况：

YAS-07202 plugin execution error, failed to create transform projection     
  YAS-07202 plugin execution error, Point outside of projection domain    
  YAS-07202 plugin execution error, No inverse operation

COMPOUND 不支持转换

# 3.   **测试设计方法**

等价类；场景分析

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

[image2023-6-8_9-49-43.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5NGNhMWFkOWEzMzExZGM3NTk1IiwicmVmX2lkIjoiNjczOTY5NGM1OTNmOTljOWZmMjM0Y2Y3IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMTI2NjA0LCJleHAiOjE3ODIyMTMwMDR9.UXKdxfMwNfwuLGmbQeViENkX_41mXELvGdIcLX0bZoI)

 (image/png)    


[ST_Transform.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5NGNhMWFkOWEzMzExZGM3NTk2IiwicmVmX2lkIjoiNjczOTY5NGM1OTNmOTljOWZmMjM0Y2Y3IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMTI2NjA0LCJleHAiOjE3ODIyMTMwMDR9.4tuAB4hcVxVy60ed5JrnbTWkOl0kd5v-fAh3Scdq8IU)

 (application/x-xmind)    


[st_transform.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5NGNhMWFkOWEzMzExZGM3NTk3IiwicmVmX2lkIjoiNjczOTY5NGM1OTNmOTljOWZmMjM0Y2Y3IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMTI2NjA0LCJleHAiOjE3ODIyMTMwMDR9.uiwDTqIXvo9OKK8hLKqD5NTe_Aexoess3Y0ECxbWeAM)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    
