Created by 张旭涛, last modified on 十一月 04, 2024

# *SR链接：*    [https://pingcode.yasdb.com/pjm/items/670747c5e489dd0868f38281](https://pingcode.yasdb.com/pjm/items/670747c5e489dd0868f38281)    *?*    
  *#YDBRD-33777 主备转换路径优化*

##   [1. 总述](https://conf.yasdb.com/pages/viewpage.action?pageId=141579922#1-%E6%80%BB%E8%BF%B0)  

  


###   [1.1 需求合理性分析](https://conf.yasdb.com/pages/viewpage.action?pageId=141579922#11-%E9%9C%80%E6%B1%82%E5%90%88%E7%90%86%E6%80%A7%E5%88%86%E6%9E%90)  

  


###   [1.2 需求实现分析](https://conf.yasdb.com/pages/viewpage.action?pageId=141579922#12-%E9%9C%80%E6%B1%82%E5%AE%9E%E7%8E%B0%E5%88%86%E6%9E%90)  

  


##   [2. 接口](https://conf.yasdb.com/pages/viewpage.action?pageId=141579922#2-%E6%8E%A5%E5%8F%A3)  

![](https://pingcode.yasdb.com/atlas/files/public/6739bd61a1ad9a3311dd8da0/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBUUFBQUFBQUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUVBQUFBRUFBQUFBQUFBQUFRQUFBQUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFFQUFBQUFBQUFBQUFBQUFDQUJBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTUyNjEsImV4cCI6MTc4MjQ2NjA2MX0.n5bzG5_QplirmIamtIfAwmLNgiP12bexQ_HLizJpJKM)

![](https://pingcode.yasdb.com/atlas/files/public/6739bd61a1ad9a3311dd8da1/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBUUFBQUFBQUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUVBQUFBRUFBQUFBQUFBQUFRQUFBQUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFFQUFBQUFBQUFBQUFBQUFDQUJBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTUyNjEsImV4cCI6MTc4MjQ2NjA2MX0.n5bzG5_QplirmIamtIfAwmLNgiP12bexQ_HLizJpJKM)

  


备库自动级联创建文件夹，保持与主库的路径一致，在备库无权限创建文件夹路径时候，会自动生成默认的文件名并创建在dbhome路径下

##   [3. 规格与约束](https://conf.yasdb.com/pages/viewpage.action?pageId=141579922#3-%E8%A7%84%E6%A0%BC%E4%B8%8E%E7%BA%A6%E6%9D%9F)  

  


##   [4. Dependency（功能依赖）](https://conf.yasdb.com/pages/viewpage.action?pageId=141579922#4-dependency%E5%8A%9F%E8%83%BD%E4%BE%9D%E8%B5%96)  

说明整个特性或子特性，在对应数据库下，调研得到的功能对第三方件的依赖，开源协议。

## Attachments: