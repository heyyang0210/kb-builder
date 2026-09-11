Created by 韩晓盼, last modified on 六月 09, 2023

SR：    [YDBRD-13388](https://jira.yasdb.com/browse/YDBRD-13388?src=confmacro)    -  支持ST_AsHexEWKB  完成

# 1.   **概述**

简要说明需求背景，本文范围如下：

（1）  支持ST_AsHexEWKB函数：  ST_AsHEXEWKB(geom geometry, NDRorXDR string)

（2）支持的Geometry类型  ：Point、LineString、Polygon、 MultiPoint、MultiLineString、 MultiPolygon、GeometryCollection

（3）  支持3D和4D，不会丢弃z-index、m-index

# 2.   **需求分析**

##### 2.0 预备知识

**1、**  **小端(NDR)或大端(XDR)编码**

大端（存储）模式，是指数据的低位保存在内存  的高地址中，而数据的高位保存在内存的低地址中（低高，高低）    
       小端（存储）模式，是指数据的低位保存在内存的低地址中，而数据的高位保存在内存的高地址中（低低，高高）

参考：    [(62条消息) 大端 / 小端，三种判断方法_如何判断大端小端_fl_sw的博客-CSDN博客](https://blog.csdn.net/qq_36391130/article/details/81944217)  

##### 2.1 函数基本特征

**    **  **ST_AsHexEWKB**  **函数**

- 功能     


      根据输入Geometry返回一个HEXEWKB格式(EWKB对应的十六进制形式)的几何体文本。

![](https://pingcode.yasdb.com/atlas/files/public/6739694fa1ad9a3311dc75ae/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBRUFBQUFBQUFBQUFBQUFBQVFEQUFBQ0FBQUFBQkFBQVFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBRUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFBUUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIxMjY2NDIsImV4cCI6MTc4MjEzNzQ0Mn0.SX3XZnK8AsBKNkpdu8g2PVhf-hN9CqqPQD39M5Ln2Qk)

- 语法


```
ST_AsHEXEWKB(geom geometry, NDRorXDR string) return clob

```

      参数1类型：geometry

      参数2类型：string

      返回类型：clob

      Null值：  geom为null返回null；NDRorXDR为null返回null

- 其他规格


      1、  如果输入的Geometry是一个不合法的Geometry，则会报解析失败的错误

      2、使用小端(NDR)或大端(XDR)编码。如果没有指定编码或输入错误编码，则使用NDR

      3、  支持3d和4d，不会丢弃z-index、m-index

参考：    [ST_AsHEXEWKB Design - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/display/YAS/ST_AsHEXEWKB+Design)  

# 3.   **测试设计方法**

边界值，等价类，场景分析等。

# 4.   **详细测试设计**

1）使用章节3的测试方法设计详细的测试点，可沿用xmind的方式

1. 复用ST_AsEWKB函数的用例，参考：    [支持以WKB 格式输入输出Geometry对象测试设计 - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=109578028)  
1. 部分测试设计，具体可以看参考链接


![](https://pingcode.yasdb.com/atlas/files/public/673969508970c2af4f51f736/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBRUFBQUFBQUFBQUFBQUFBQVFEQUFBQ0FBQUFBQkFBQVFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBRUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFBUUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIxMjY2NDIsImV4cCI6MTc4MjEzNzQ0Mn0.SX3XZnK8AsBKNkpdu8g2PVhf-hN9CqqPQD39M5Ln2Qk)

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

测试设计细化后的文本用例

详见：

# 6.   **测试框架设计**

1. 沿用guider框架


# 7.   **测试环境说明**

|服务器类型|操作系统|服务器个数|部署节点|
|:---|:---|:---|:---|
|VM|CentOS Linux release 7.9.2009 (Core)|1|  
|


## Attachments:

[image2023-6-9_15-26-15.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5NGY4OTcwYzJhZjRmNTFmNzMzIiwicmVmX2lkIjoiNjczOTY5NGY3MjgyMDZlZmI5MmVmMWI4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMTI2NjQyLCJleHAiOjE3ODIyMTMwNDJ9.FbHvWNJm6nE-uU3D-T9nf-tiabcDEfvqYgTUg1iZGnI)

 (image/png)    


[image2023-6-8_18-28-7.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5NGZhMWFkOWEzMzExZGM3NWFhIiwicmVmX2lkIjoiNjczOTY5NGY3MjgyMDZlZmI5MmVmMWI4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMTI2NjQyLCJleHAiOjE3ODIyMTMwNDJ9.otxOUXAYQBFK5gLzg1ABwcyTmUZ1UmKmTDnpKoPRjNI)

 (image/png)    


[image2023-6-6_17-36-21.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5NGZhMWFkOWEzMzExZGM3NWFiIiwicmVmX2lkIjoiNjczOTY5NGY3MjgyMDZlZmI5MmVmMWI4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMTI2NjQyLCJleHAiOjE3ODIyMTMwNDJ9.H-seZ7YbhF7rEuTSjWvztw2m5TWCFKl0jkWTJNluZ9E)

 (image/png)    


[image2023-5-9_11-26-14.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5NGZhMWFkOWEzMzExZGM3NWFjIiwicmVmX2lkIjoiNjczOTY5NGY3MjgyMDZlZmI5MmVmMWI4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMTI2NjQyLCJleHAiOjE3ODIyMTMwNDJ9.STpea7lxTGGI9dBc8BSSbI96XjI7SBzHupsOXPrKQ5U)

 (image/png)    


[image2023-5-11_11-3-25.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5NGZhMWFkOWEzMzExZGM3NWFkIiwicmVmX2lkIjoiNjczOTY5NGY3MjgyMDZlZmI5MmVmMWI4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMTI2NjQyLCJleHAiOjE3ODIyMTMwNDJ9.vHNsLT5UWqhZ8FpNu0bRr_8kpDKxiV7I3_SB9M01ouE)

 (image/png)    


## Comments:

|  [](null)  ,注：ST_AsEWKB与ST_AsHEXEWKB函数返回类型不同,![](https://conf.yasdb.com/download/attachments/113967865/image2023-6-9_15-26-15.png?version=1&modificationDate=1686295575000&api=v2?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBRUFBQUFBQUFBQUFBQUFBQVFEQUFBQ0FBQUFBQkFBQVFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBRUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFBUUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIxMjY2NDIsImV4cCI6MTc4MjEzNzQ0Mn0.SX3XZnK8AsBKNkpdu8g2PVhf-hN9CqqPQD39M5Ln2Qk),Posted by hanxiaopan at 六月 09, 2023 15:29|
|---|
