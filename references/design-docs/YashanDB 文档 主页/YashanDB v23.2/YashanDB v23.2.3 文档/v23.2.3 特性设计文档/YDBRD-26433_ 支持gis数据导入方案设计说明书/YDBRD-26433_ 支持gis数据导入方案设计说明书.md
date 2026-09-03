Created by 贺国锋, last modified on 五月 22, 2024

需求：    [https://pingcode.yasdb.com/pjm/items/661e7559fd997db58adae95e](https://pingcode.yasdb.com/pjm/items/661e7559fd997db58adae95e)    ?#YDBRD-26433 【yasldr】支持gis对象以csv文件导入到yashandb

#   [1. 总述](https://conf.yasdb.com/pages/viewpage.action?pageId=138545264#1-%E6%80%BB%E8%BF%B0)  

yasldr需要支持csv格式的gis数据导入到YashanDB数据库中。

##   [2. ](https://conf.yasdb.com/pages/viewpage.action?pageId=138545264#4-%E7%89%B9%E6%80%A7)    功能列表

1、yasldr支持csv格式的gis数据导入

#   [3. 规格与约束](https://conf.yasdb.com/pages/viewpage.action?pageId=138545264#3-%E8%A7%84%E6%A0%BC%E4%B8%8E%E7%BA%A6%E6%9D%9F)  

1、待导入的csv数据不包含表名和列名等其他信息

2、待导入的csv数据中的gis列数据可以通过    `ST_GeomFromText函数直接转换而来。`  

#   [4. 特性](https://conf.yasdb.com/pages/viewpage.action?pageId=138545264#4-%E7%89%B9%E6%80%A7)  

## 4.1 现状分析

1、当前ST_GEOMETRY类型在YashanDB中存储的类型是UDT_OBJECT类型，其type为  DTYPE_UDT_OBJECT。

2、当前yasldr和load data不支持UDT类型的导入，在导入数据类型效验处就会拦截

3、国密算法合入后，C驱动在prepare的时候，可以拿到UDT的类型，并且拿到UDT的名称，ST_GEOMETRY。

4、BatchInsert协议服务端没有执行层信息，若在BatchInsert中，为数据增加  ST_GeomFromText的转换，则执行层无法执行。

5、yasldr限制单列大小不能超过32KB，否则会报错；packet_size限制128KB，影响效率；yasldr支持的packet_size上限512KB，且参数没有使用起来

6、csv文件单行大小限制126KB，csv_chunk_size大小限制1G。

## 4.2 方案设计

1、gis数据导入时，必须指定mode=basic方式才能进行导入，否则报错。

2、yasldr针对gis这种UDT类型进行特殊处理，除GIS外，其他UDT类型暂不支持。Load Data不支持GIS数据导入。

3、增加命令行参数csv_line_size，默认值保持现状为126KB，参数取值范围[1 - 1024*1024]，参数单位为KB。即支持的GIS数据单列最大为1GB。（针对所有模式）

4、修改CSV_CHUNK_SIZE的取值范围，将最大值提升到4GB。（当前最大值为1GB）。（针对所有模式）

5、针对basic导入模式，取消当前“列不能超过32KB大小” 的限制，修改为不能超过csv_line_size大小的限制。（针对basic模式）

6、增加命令行参数gis_srid，用来指定导入gis的坐标系，默认值为0。取值范围[0, INT_MAX]。

## 4.3 执行流程

![](https://pingcode.yasdb.com/atlas/files/public/67396d4ea1ad9a3311dc905f/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQkFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUNJQUFFQUFJQUNBQUJBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQkFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBUUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDcyMDksImV4cCI6MTc4MjMxODAwOX0.VS9EYvJPjSNciG9Gd0nNCCIi4JH0HHCz-foerWunpe4)

![](https://pingcode.yasdb.com/atlas/files/public/67396d4e8970c2af4f5211f0/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQkFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUNJQUFFQUFJQUNBQUJBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQkFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBUUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDcyMDksImV4cCI6MTc4MjMxODAwOX0.VS9EYvJPjSNciG9Gd0nNCCIi4JH0HHCz-foerWunpe4)

  


# 5.兼容性

不涉及

#   [6.未来规划](https://conf.yasdb.com/pages/viewpage.action?pageId=138545264#5%E6%9C%AA%E6%9D%A5%E8%A7%84%E5%88%92)  

# 7.附录

样例数据：

  


## Attachments:

[image2024-4-23_10-59-54.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkNGVhMWFkOWEzMzExZGM5MDVkIiwicmVmX2lkIjoiNjczOTZkNGU3MjgyMDZlZmI5MmYxZDRlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA3MjA5LCJleHAiOjE3ODIzOTM2MDl9.XUpidoZNLRrUhmqtYhHFbNrOMGzrQD-GvN7nzy3Ww_g)

 (image/png)    


[gis_data_sample.csv](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkNGVhMWFkOWEzMzExZGM5MDVlIiwicmVmX2lkIjoiNjczOTZkNGU3MjgyMDZlZmI5MmYxZDRlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA3MjA5LCJleHAiOjE3ODIzOTM2MDl9.BB8aVJBwfA8ANH_70AuzFibfG_iKwSzPZpPSN0HkUtE)

 (text/csv)    


## Comments:

|  [](null)  ,yasldr 导入GIS数据，需要  ST_GeomFromText函数包含gis数据，在当前batch模式下不能解析这个数据。只用basic，性能有较大影响,1. yashandb支持 varchar2UDT / UDT2varchar
1. batch模式支持解析，prepare?
,长期看1比较合适,Posted by yangdeliu at 四月 22, 2024 20:07|
|---|
|  [](null)  ,与会人：范瑜、陈钦卿、冯皓博、叶子、贺国锋,方案评审会议纪要：    
  1、去除UDT_FUNC参数，不支持其他UDT。    
  2、空间坐标系的参数如何给。,    --增加命令行参数gis_srid，用来给出坐标系，默认值0，  取值范围[0, INT_MAX]。    
  3、和产品确认下同一个CSV中的数据是否同一个坐标系。,    --和覃天确认是需要调研PG现状，调研PG现状是同一个shp文件使用同一坐标系，因此我们的同一个csv文件默认同一个坐标系。    
  4、和产品确认下性能要求。,    – 和覃天确认没有性能要求。,Posted by heguofeng at 四月 23, 2024 12:04|
