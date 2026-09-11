Created by 江祉涵, last modified on 十月 31, 2023

##   [一、功能](#一功能)  

local索引无法自己add partition或者drop partition 索引分区的add/drop跟随表的分区的add/drop

|功能|结果|
|---|---|
|modify partition unsuable|该分区下的所有子分区都变为unusable|
|modify subpartition unusable|该子分区变为unusable|
|modify partition physicalAttr|分区和子分区都会修改，对于hash分区会报错|
|modify subpartition physicalAttr|报错|
|rebuild partition|报错无法对有子分区的分区进行rebuild|
|rebuild subpartition|成功|
|modify partition coalesce|报错|
|modify subpartition coalesce|成功|


##   [二、语法](#二语法)  

![](https://pingcode.yasdb.com/atlas/files/public/67396b3fa1ad9a3311dc817d/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQVFBQUFBQVFBQVFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUFBQUFBQ0JBRUFBQkFBQWdBQUFBQUFBQUFBQUFBQUFBQUNBQUFBUUFBQUFBSUFBQUFBQUFBQUFBQUFnQUFBQUFBQUNBQUFBQUFBQUJBQUFBQUFBQVFBQUFBQUFDQ0FCQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTIyODcsImV4cCI6MTc4MjMwMzA4N30.OdODKzWNtyo1vkaHOXr_MFni4tjcEfxDfFpOyFJI2fI)

![](https://pingcode.yasdb.com/atlas/files/public/67396b3f8970c2af4f520308/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQVFBQUFBQVFBQVFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUFBQUFBQ0JBRUFBQkFBQWdBQUFBQUFBQUFBQUFBQUFBQUNBQUFBUUFBQUFBSUFBQUFBQUFBQUFBQUFnQUFBQUFBQUNBQUFBQUFBQUJBQUFBQUFBQVFBQUFBQUFDQ0FCQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTIyODcsImV4cCI6MTc4MjMwMzA4N30.OdODKzWNtyo1vkaHOXr_MFni4tjcEfxDfFpOyFJI2fI)

  


![](https://pingcode.yasdb.com/atlas/files/public/67396b3fa1ad9a3311dc817e/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQVFBQUFBQVFBQVFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUFBQUFBQ0JBRUFBQkFBQWdBQUFBQUFBQUFBQUFBQUFBQUNBQUFBUUFBQUFBSUFBQUFBQUFBQUFBQUFnQUFBQUFBQUNBQUFBQUFBQUJBQUFBQUFBQVFBQUFBQUFDQ0FCQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTIyODcsImV4cCI6MTc4MjMwMzA4N30.OdODKzWNtyo1vkaHOXr_MFni4tjcEfxDfFpOyFJI2fI)

![](https://pingcode.yasdb.com/atlas/files/public/67396b3f8970c2af4f520309/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQVFBQUFBQVFBQVFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUFBQUFBQ0JBRUFBQkFBQWdBQUFBQUFBQUFBQUFBQUFBQUNBQUFBUUFBQUFBSUFBQUFBQUFBQUFBQUFnQUFBQUFBQUNBQUFBQUFBQUJBQUFBQUFBQVFBQUFBQUFDQ0FCQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTIyODcsImV4cCI6MTc4MjMwMzA4N30.OdODKzWNtyo1vkaHOXr_MFni4tjcEfxDfFpOyFJI2fI)

  


##   [三、用例](#三用例)  

|分区类型|测试场景|测试语句|测试结果|
|---|---|---|---|
|hash-hash|测试modify partition unusable|alter index hh_idx modify partition hh_pi1 unusable;|报错修改一个含有二级分区的一级分区还未实现  (oracle 可以）|
|  
|测试modify partition coalesce|alter index hh_idx modify partition hh_pi1 COALESCE;|报错无法coalesce一个含有组合分区的分区|
|  
|测试modify partition physical_attributes|alter index hh_idx modify partition hh_pi1 initrans 8;|报错修改一个含有二级分区的一级分区还未实现(oracle 报错无法修改散列索引分区的物理属性)|
|  
|测试modify subpartition unusable|alter index hh_idx modify subpartition hh_subpi1 unusable;|成功|
|  
|测试modify subpartition coalesce|alter index hh_idx modify subpartition hh_subpi1 COALESCE;|成功|
|  
|测试modify partition physical_attributes|alter index hh_idx modify subpartition hh_subpi1 initrans 8;|成功(oracle 无效的modify subpartition选项)|
|  
|测试rebuild index partition|alter index hh_idx rebuild partition hh_pi1;|报错无法rebuild一个含有组合分区的分区|
|  
|测试rebuild index subpartition|alter index hh_idx rebuild subpartition hh_subpi1;|成功。|
|  
|测试rebuild index subpartition online|alter index hh_idx rebuild subpartition hh_subpi1 online;|成功|
|  
|测试rebuild index subpartition reverse|alter index hh_idx rebuild subpartition hh_subpi1 reverse;|报错无法在此上下文中指定reverse|
|  
|测试rebuild index subpartition physical_attribute|alter index hh_idx rebuild subpartition hh_subpi1 tablespace users initrans 5 PCTFREE 2;|成功 （oracle报错 无法对该分区指定此物理属性)|
|list-hash|测试modify partition unusable|alter index hh_idx modify partition hh_pi1 unusable;|报错修改一个含有二级分区的一级分区还未实现(oracle 可以）|
|  
|测试modify partition coalesce|alter index hh_idx modify partition hh_pi1 COALESCE;|报错无法coalesce一个含有组合分区的分区|
|  
|测试modify partition physical_attributes|alter index hh_idx modify partition hh_pi1 initrans 8;|报错修改一个含有二级分区的一级分区还未实现(oracle 成功)|
|  
|测试modify subpartition unusable|alter index hh_idx modify subpartition hh_subpi1 unusable;|成功|
|  
|测试modify subpartition coalesce|alter index hh_idx modify subpartition hh_subpi1 COALESCE;|成功|
|  
|测试modify partition physical_attributes|alter index hh_idx modify subpartition hh_subpi1 initrans 8;|成功(oracle 无效的modify subpartition选项)|
|  
|测试rebuild index partition|alter index hh_idx rebuild partition hh_pi1;|报错无法rebuild一个含有组合分区的分区|
|  
|测试rebuild index subpartition|alter index hh_idx rebuild subpartition hh_subpi1;|成功。|


##   [四、基础用例](#四基础用例)  

详情请看附件

  


  


  


  


  


## Attachments:

[alter_index_partition1.gif](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiM2ZhMWFkOWEzMzExZGM4MTc2IiwicmVmX2lkIjoiNjczOTZiM2Y3MjgyMDZlZmI5MmYwMzZkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkyMjg3LCJleHAiOjE3ODIzNzg2ODd9.pknDDX3oqn5dzQx-QwnbzUMB-AQOjCkYeKKZOwPWbHk)

 (image/gif)    


[modify_index_subpartition.gif](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiM2Y4OTcwYzJhZjRmNTIwMzAyIiwicmVmX2lkIjoiNjczOTZiM2Y3MjgyMDZlZmI5MmYwMzZkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkyMjg3LCJleHAiOjE3ODIzNzg2ODd9.0w_EKTRZH1ul_iIYh173i-t28biitDBpyfDGikP3pos)

 (image/gif)    


[rebuild_cluase.gif](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiM2Y4OTcwYzJhZjRmNTIwMzAzIiwicmVmX2lkIjoiNjczOTZiM2Y3MjgyMDZlZmI5MmYwMzZkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkyMjg3LCJleHAiOjE3ODIzNzg2ODd9.rcMzPRZmsRQJo4LEPlNxrPUn3wR9YL2i0hgan1SHUag)

 (image/gif)    


[alter_composite.sql](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiM2Y4OTcwYzJhZjRmNTIwMzA0IiwicmVmX2lkIjoiNjczOTZiM2Y3MjgyMDZlZmI5MmYwMzZkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkyMjg3LCJleHAiOjE3ODIzNzg2ODd9.Ly5M6_QkR2i3kok8hYOSTgNYEkcfPUNKdwfeVpiL5RU)

 (application/octet-stream)    
