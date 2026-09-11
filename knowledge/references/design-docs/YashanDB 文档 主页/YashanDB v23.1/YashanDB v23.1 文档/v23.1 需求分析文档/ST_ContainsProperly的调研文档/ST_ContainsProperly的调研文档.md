Created by 李美娥, last modified on 十一月 24, 2023

#   [1. Overview（概述）](https://conf.yasdb.com/display/YAS/ST_LongestLine+Design#1-overview%E6%A6%82%E8%BF%B0)  

- ST_ContainsProperly  函数的功能是：  如果两个输入几何体都为非空，并且第二个几何体的 2D 投影的所有点都是第一个几何体的 2D 投影的内部点，则 ST_ContainsProperly 返回 true。  或者  如果Geometry对象B完全在Geometry对象A的内部，则返回True。
- geom1与geom2的srid如果不同则报错。
- 该函数只会计算2D，如果输入的是三维，则会忽略Z坐标进行计算。
- 任意入参是纯EMPTY,返回的是false。
- 输入为null则返回null。
- 无效的Geometry对象，会报错。
- 两个对象的DE-9IM相交矩阵符合  [T**FF*FF*]。


汇总：不允许交点在边界上（包括线的端点），其他同  ST_Contains。

#   [2. Grammer（语法）](https://conf.yasdb.com/display/YAS/ST_LongestLine+Design#2-grammer%E8%AF%AD%E6%B3%95)  

```
<span class="hljs-type" style="color: rgb(152,104,1);">boolean</span>  ST_ContainsProperly(geometry  geomA , geometry  geomB);
```

#   [3. 常用场景（接口）](https://conf.yasdb.com/display/YAS/ST_LongestLine+Design#3-interfaces%E6%8E%A5%E5%8F%A3)  

应用场景：采用  ST_Intersection求交集相对比较慢，可以用  ST_ContainsProperly先过滤出是true的，那么  geomA肯定是交集。

![](https://pingcode.yasdb.com/atlas/files/public/6739695a8970c2af4f51f787/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUJBSUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBZ0FBUUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBSUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTM0NjUsImV4cCI6MTc4MjMwNDI2NX0.AwA57ilZrawDn6toOZmFiCFHPfu3YLqKhAta4W8bWfM)

此函数的优势：比    [ST_Contains](https://www.osgeo.cn/postgis-manual/ST_Contains.html)     和     [ST_Intersects](https://www.osgeo.cn/postgis-manual/ST_Intersects.html)    更有有效快速。

  ``  

#   `与其他包含函数的区别：`      [4. Example（用例）](https://conf.yasdb.com/display/YAS/ST_LongestLine+Design#5-example%E7%94%A8%E4%BE%8B)  

```
见初验用例

```

#   [5. Reference（参考文档）](https://conf.yasdb.com/display/YAS/ST_LongestLine+Design#6-reference%E5%8F%82%E8%80%83%E6%96%87%E6%A1%A3)  

  [ST_ContainsProperly - Amazon Redshift](https://docs.aws.amazon.com/zh_cn/redshift/latest/dg/ST_ContainsProperly-function.html)       

  [https://help.aliyun.com/zh/rds/apsaradb-rds-for-postgresql/st-containsproperly-1](https://help.aliyun.com/zh/rds/apsaradb-rds-for-postgresql/st-containsproperly-1)  

  [https://blog.csdn.net/weixin_54000907/article/details/114559526](https://blog.csdn.net/weixin_54000907/article/details/114559526)  

  [https://www.osgeo.cn/postgis-manual/ST_ContainsProperly.html](https://www.osgeo.cn/postgis-manual/ST_ContainsProperly.html)  

#   [6. 后续关注](https://conf.yasdb.com/display/YAS/ST_LongestLine+Design#6-reference%E5%8F%82%E8%80%83%E6%96%87%E6%A1%A3)  

（1）此函数跟  ST_Contains，满足条件下，也是要走rtree的。

（2）是否跟ST_Contains一样，从表获取geom参数和直接传入geom对象，是否走的不同函数入口，2个接口是否都要测试。

  


## Attachments: