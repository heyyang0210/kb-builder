Created by 李美娥, last modified on 十二月 19, 2023

1. 参考资料

        需求：    [YDBRD-18927](https://jira.yasdb.com/browse/YDBRD-18927?src=confmacro)    -  支持ST_IsValid、 ST_IsEmpty、 ST_IsSimple  完成

        开发设计：    [https://conf.yasdb.com/display/YAS/ST_IsValid+Design](https://conf.yasdb.com/display/YAS/ST_IsValid+Design)      
    [                          https://conf.yasdb.com/display/YAS/ST_IsSimple+Design](https://conf.yasdb.com/display/YAS/ST_IsSimple+Design)      
    [                          https://conf.yasdb.com/display/YAS/ST_IsEmpty+Design](https://conf.yasdb.com/display/YAS/ST_IsEmpty+Design)  

        对外提供的函数：    [ST_IsValid](https://conf.yasdb.com/display/YAS/ST_IsValid+Design)    、    [ST_IsSimple](https://conf.yasdb.com/display/YAS/ST_IsSimple+Design)    、    [ST_IsEmpty](https://conf.yasdb.com/display/YAS/ST_IsEmpty+Design)  

        函数目前支持的类型：Point、LineString、LinearRing、Polygon、 MultiPoint、MultiLineString、 MultiPolygon、GeometryCollection类型

2.   **需求分析**

对功能/需求进行详细说明及分析，包括但不限于需求涉及的规格、约束，主要业务场景，系统/模块上下文等

2.1 函数功能

     （1）    [ST_IsEmpty](https://conf.yasdb.com/display/YAS/ST_IsEmpty+Design)    ,入参是  geometry，返回类型是boolean。  如果  Geometry是空几何图形，则返回true，同时x y坐标均为nan也会被视为空几何图形。

              比如st_geomfromtext('MULTIPOINT((nan nan),EMPTY)')，yanshan是返回的true，pg返回false。

     （2）   ST_IsValid,几何有效性主要适用于二维几何(面、多面、集合里面含面或多面）。

               点--true    
                 多点--true    
                 线--true    
                 多线–true

                 备注：点、多点、线、多线等若含的坐标是double边界，返回的是false。nan nan的点是true。    
                 面：环闭合、内环在外环里面、环不能自相交、环不能与其他环接触（仅允许一个点相切）

              SQL> select ST_Isvalid(st_geomfromtext('MULTIPOLYGON (((0 0,80 0,80 80,0 80,0 0),(1 1,79 1,79 79,1 79,1 1),(2 2,76 2,76 76,2 76,2 2),(3 3,75 3,75 75,3 75,3 3),(30 50,60 50,60 70,30 70,30 50)))')) from dual;  （孔是一层层套进去的)

                       ST_ISVALID(ST_GEOMFR    
                         --------------------    
                          false

  
                 多面：所有的元素面都是有效，元素内部不相交，元素仅在边界点接触    
                 集合：如果所有元素都是有效的，则有效。元素间没要求。    
                 empty：--true     

     （3）       [ST_IsSimple](https://conf.yasdb.com/display/YAS/ST_IsSimple+Design)    ,待修改。

               点--true    
                 多点，不要存在相等的点(xy存在一个不一样，就不相等），nan nan跟empty相等，要是含的是nan nan,empty，会认为是相等的点是吗，就不是simple（  pg返回的是false，yanshan返回的是true  ，select ST_IsEmpty(st_geomfromtext('MULTIPOINT((nan nan), EMPTY)'));）    
                 线：内点不相交    
                 多线：里面的线是simple，然后线与线间不内点相交    


                   备注：点、多点、线、多线等若含的坐标是double边界，会报错IllegalArgumentException  。nan nan的点是true。    
                 面：是由线性环构成的，所以多边形有效时，则简单。（理解仅非线性环构成时是false）（验证：面的孔比外环还大，是simple的；空跟外环相切，是simple）  --  多边形的环只要不自相交，则该多边形就是简单的（网上有这么解释的）

               测试的结果：自相交和封闭但不是环是false，其他都是true。（对于含double边界的面是报错，valid是返回false）。

               多面：如果所有元素都是简单的，则简单    
                 集合：如果所有元素都是简单的，则简单。元素间没要求。    
                 empty：--true

# 3.   **测试设计方法**

等价类，边界值，场景分析。

入参为geometry类型。可以通过输入函数（st_geomFromText、st_geomFromWKB、st_geomFromEWKB、  ST_GeomFromGeoJson  ）传入,也可以是表中geometry类型的列。

- 支持2 （X  Y），3 (X Y Z)，4 (X Y Z M)维坐标的输入，此sr函数ZM不参与比较，仅比较X Y的关系。。
- 构造的数据误差范围：  小数点后面15位，  15位内没有差异，16位A比B多或者少，认为是不同的点。
- srid：  使用常用的4326、4610、  4490、4214等。（    [SRID WKID 空间参考简介_srid和wkid_bigbigtree911的博客-CSDN博客](https://blog.csdn.net/bigbigtreewhu/article/details/52162277?ops_request_misc=%257B%2522request%255Fid%2522%253A%2522168197695316800188553300%2522%252C%2522scm%2522%253A%252220140713.130102334..%2522%257D&request_id=168197695316800188553300&biz_id=0&utm_medium=distribute.pc_search_result.none-task-blog-2~all~sobaiduend~default-1-52162277-null-null.142^v85^insert_down1,239^v2^insert_chatgpt&utm_term=%E5%B8%B8%E7%94%A8%E7%9A%84srid&spm=1018.2226.3001.4187)    ），跟srid无关。
- 超长文本入参（geom）
- null和空串，含empty
- nan inf -inf


因仍是函数，测试点仍可参考内置函数的通用测试点，主要在于是否构造针对函数的数据进行测试，会根据函数特点构造一部分数据，同时会复用postgis的数据，与已提供的其他gis相关函数结合测试。

# 4.   **详细测试设计**

1）使用章节3的测试方法设计详细的测试点，可沿用xmind的方式

函数的测试点本质同内置函数，参考    [*内置函数测试设计checklist - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=76929071)    的测试点，进行设计。(作为查询条件要着重测试）

  


2）梳理该特性是否涉各个专项测试，并在详细设计中描述具体测试点

|专项|是否涉及|
|:---|:---|
|并发|是|
|长稳|是|
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

   电子表格

[迭代六gis函数.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5NDlhMWFkOWEzMzExZGM3NTgzIiwicmVmX2lkIjoiNjczOTY5NDk1OTNmOTljOWZmMjM0Y2Q3IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMTI2NTQ1LCJleHAiOjE3ODIyMTI5NDV9.ZeNKSFnob-LKI2s28zwc_ON7nGnkCh6CNoMuI6VIBZM)

# 6.   **测试框架设计**

1. 如果用例不能实现自动化需要在此标注并说明原因
1. 如果需要使用新的测试框架实现用例的自动化，需要在此说明测试框架的架构逻辑及详细设计
1. 如果沿用已有测试框架，需要在此标注测试框架的路径


# 7.   **测试环境说明**

测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等

# 8. 差异点记录

插入的数据是右边的，yanshan会处理成左边，pg仍是右边。

![](https://pingcode.yasdb.com/atlas/files/public/67396949a1ad9a3311dc7587/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBRUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBSUFBQUFBQUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFRQUFBQUFBQUFBQUFBQUFBQUFBQ0FBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIxMjY1NDYsImV4cCI6MTc4MjEzNzM0Nn0.hBUUBHGFhUewkwGr0lDpJFz-nY4eQ9UeTSVoBeS2n1o)

## Attachments:

[image2023-5-24_17-24-35.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5NDlhMWFkOWEzMzExZGM3NTg2IiwicmVmX2lkIjoiNjczOTY5NDk1OTNmOTljOWZmMjM0Y2Q3IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMTI2NTQ1LCJleHAiOjE3ODIyMTI5NDV9.Hhv9f91I3v0nbkNmJCVXXeAQVVK1S2AagZi0Im3zmgE)

 (image/png)    


[迭代六gis函数.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5NDlhMWFkOWEzMzExZGM3NTgzIiwicmVmX2lkIjoiNjczOTY5NDk1OTNmOTljOWZmMjM0Y2Q3IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMTI2NTQ1LCJleHAiOjE3ODIyMTI5NDV9.ZeNKSFnob-LKI2s28zwc_ON7nGnkCh6CNoMuI6VIBZM)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    
