Created by 江祉涵, last modified on 七月 07, 2023

###   [一、功能](#一功能)  

- 给指定的一级分区添加多个二级分区(hash分区只能添加一个)
- 能够shrink指定的一级分区和二级分区


###   [二、语法树](#二语法树)  

![](https://pingcode.yasdb.com/atlas/files/public/67396b428970c2af4f520327/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFCQUFBQUFBQUFBQUFBQUFBUUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFBQUFBQW9BQUFBQUVBQUFBQUFBQUFBQUFBQVFBQUFBQUFBQUFBQUFBQ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFDRUFBQUFBQUFBQUFBQUFBQUFBQUFJRUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUJBQUNBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTI0MDYsImV4cCI6MTc4MjMwMzIwNn0.558SlL9Ayn5ZOVureWW3cTINVfKzMK-whroBhiHOBTM)

![](https://pingcode.yasdb.com/atlas/files/public/67396b428970c2af4f520328/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFCQUFBQUFBQUFBQUFBQUFBUUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFBQUFBQW9BQUFBQUVBQUFBQUFBQUFBQUFBQVFBQUFBQUFBQUFBQUFBQ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFDRUFBQUFBQUFBQUFBQUFBQUFBQUFJRUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUJBQUNBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTI0MDYsImV4cCI6MTc4MjMwMzIwNn0.558SlL9Ayn5ZOVureWW3cTINVfKzMK-whroBhiHOBTM)

![](https://pingcode.yasdb.com/atlas/files/public/67396b42a1ad9a3311dc81a0/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFCQUFBQUFBQUFBQUFBQUFBUUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFBQUFBQW9BQUFBQUVBQUFBQUFBQUFBQUFBQVFBQUFBQUFBQUFBQUFBQ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFDRUFBQUFBQUFBQUFBQUFBQUFBQUFJRUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUJBQUNBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTI0MDYsImV4cCI6MTc4MjMwMzIwNn0.558SlL9Ayn5ZOVureWW3cTINVfKzMK-whroBhiHOBTM)

  


  


  


###   [三、约束](#三约束)  

- 指定添加的range二级分区的bound需要递增并且首个分区要大于该一级分区下的最后一个分区
- 指定添加的list 二级分区的bound不能有重复
- 指定添加的二级分区类型需要和表的二级分区类型一致
- 若有local索引，创建的二级分区索引默认为usable


  


  


###   [三、测试用例](#三测试用例)  

  


|二级分区类型|测试用例|输出结果|
|---|---|---|
|hash    
    
    
    
    
|alter table hh_composite modify partition p1 add subpartition p1_sub4;|成功|
||alter table hh_composite modify partition p1 add subpartition p1_sub5, subpartition p1_sub6;|报错|
||alter table hh_composite modify partition p1 add subpartition p1_sub5 values less than 20;|报错|
||alter table hh_composite modify partition p1 add subpartition p1_sub5 values (10);|报错|
||alter table hh_composite modify partition p1 shrink space;|成功|
||alter table hh_composite modify subpartition p1_sub1 shrink space;|成功|
|range|alter table hr_composite modify partition p1 add subpartition p1_sub4;|失败|
||alter table hr_composite modify partition p1 add subpartition p1_sub4 values less than(100);|失败|
||alter table hr_composite modify partition p1 add subpartition p1_sub4 values (10);|失败|
||alter table hr_composite modify partition p1 add subpartition p1_sub4 values less than(160);|成功|
||alter table hr_composite modify partition p1 add subpartition p1_sub5, subpartition p1_sub6;|失败|
||alter table hr_composite modify partition p1 add subpartition p1_sub5 values less than(200), subpartition p1_sub6 values less than(180);|失败|
||alter table hr_composite modify partition p1 add subpartition p1_sub5 values less than(200), subpartition p1_sub6 values(180);|失败|
||alter table hr_composite modify partition p1 add subpartition p1_sub5 values less than(200), subpartition p1_sub6 values less than(240);|成功|
|list|alter table hl_composite modify partition p1 add subpartition p1_sub4;|失败|
|  
|alter table hl_composite modify partition p1 add subpartition p1_sub4 values less than(100);|失败|
|  
|alter table hl_composite modify partition p1 add subpartition p1_sub4 values (2);|失败|
|  
|alter table hl_composite modify partition p1 add subpartition p1_sub4 values (3);|成功|
|  
|alter table hl_composite modify partition p1 add subpartition p1_sub5, subpartition p1_sub6;|失败|
|  
|alter table hl_composite modify partition p1 add subpartition p1_sub5 values(4), subpartition p1_sub6 values(4);|失败|
|  
|alter table hl_composite modify partition p1 add subpartition p1_sub5 values(4), subpartition p1_sub6 values(2);|失败|
|  
|alter table hl_composite modify partition p1 add subpartition p1_sub5 values(4), subpartition p1_sub6 values(5);|成功|


## Attachments:

[modify_table_partition.gif](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiNDJhMWFkOWEzMzExZGM4MTk0IiwicmVmX2lkIjoiNjczOTZiNDI3MjgyMDZlZmI5MmYwMzg3IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkyNDA2LCJleHAiOjE3ODIzNzg4MDZ9.sx2OO48NHrX1ufAB397AwzTYMYsM3awXXkO57nXJtcc)

 (image/gif)    


[modify_range_partition.gif](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiNDJhMWFkOWEzMzExZGM4MTk2IiwicmVmX2lkIjoiNjczOTZiNDI3MjgyMDZlZmI5MmYwMzg3IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkyNDA2LCJleHAiOjE3ODIzNzg4MDZ9.UP5ln7y2Vl9AFu8fInou2OWa0SifpTWkI8Rtqu3yCXo)

 (image/gif)    


[modify_hash_partition.gif](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiNDI4OTcwYzJhZjRmNTIwMzFmIiwicmVmX2lkIjoiNjczOTZiNDI3MjgyMDZlZmI5MmYwMzg3IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkyNDA2LCJleHAiOjE3ODIzNzg4MDZ9.oej_k7VAyX16MajR57Ie2phVQpyWQ6_phYLUid4HrIU)

 (image/gif)    


[modify_list_partition.gif](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiNDI4OTcwYzJhZjRmNTIwMzIwIiwicmVmX2lkIjoiNjczOTZiNDI3MjgyMDZlZmI5MmYwMzg3IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkyNDA2LCJleHAiOjE3ODIzNzg4MDZ9.cvM97A02OMaADMATsRAFJtt9sPa3OsNE6_LCi2NtiRc)

 (image/gif)    


[modify_table_subpartition.gif](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiNDJhMWFkOWEzMzExZGM4MTlhIiwicmVmX2lkIjoiNjczOTZiNDI3MjgyMDZlZmI5MmYwMzg3IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkyNDA2LCJleHAiOjE3ODIzNzg4MDZ9.VXfGwkS8PatH8LMLLCM_KcRCZzRA7-llPTs3RTp988E)

 (image/gif)    


[partition_attributes.gif](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiNDI4OTcwYzJhZjRmNTIwMzIyIiwicmVmX2lkIjoiNjczOTZiNDI3MjgyMDZlZmI5MmYwMzg3IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkyNDA2LCJleHAiOjE3ODIzNzg4MDZ9.It0y81g_6qYgpx_f81gHcxzIdvuCXB-1ruxOSb8OX38)

 (image/gif)    


[modify_partition.GIF](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiNDI4OTcwYzJhZjRmNTIwMzIzIiwicmVmX2lkIjoiNjczOTZiNDI3MjgyMDZlZmI5MmYwMzg3IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkyNDA2LCJleHAiOjE3ODIzNzg4MDZ9.sPLbPfy2lO30Y-j1r7eU560X4opWdBAgThV2vV2F8Yc)

 (image/gif)    
