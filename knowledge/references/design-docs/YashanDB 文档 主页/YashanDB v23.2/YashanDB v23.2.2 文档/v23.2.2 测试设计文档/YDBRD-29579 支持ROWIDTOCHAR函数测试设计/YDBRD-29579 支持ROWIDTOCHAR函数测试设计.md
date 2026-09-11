Created by 韩晓盼, last modified on 四月 08, 2024

IR：    [YDBRD-28586](https://jira.yasdb.com/browse/YDBRD-28586?src=confmacro)    -  支持ROWIDTOCHAR函数  设计中

SR：    [YDBRD-29579](https://jira.yasdb.com/browse/YDBRD-29579?src=confmacro)    -  支持ROWIDTOCHAR函数  设计中

# 1.   **概述**

本需求设计范围是支持ROWIDTOCHAR函数  。

# 2.   **需求分析**

**1、ROWIDTOCHAR函数介绍**

- **定义**


ROWIDTOCHAR函数  将rowid值转换为VARCHAR数据类型，其长度视rowid值而定；

- **语法**


  `rowidtochar::= ROWIDTOCHAR"(" rowid ")"`  

![](https://pingcode.yasdb.com/atlas/files/public/67396cb58970c2af4f520e02/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBSUFBQVFBQWdBSUFBQUFBQUFBQUFBQUFFQUFBQUFBQUFBQUFBQUFBQUFBZ0FBQUFBQUVJQUFBQ0FBQUFBQUFBQUFBUUFBQUFBQUJBQUFRQUFBQUFBQUFBQUFCQUFBQUFBQUFBQUFBZ0FDQUVBQUFBQUFFQUFBQUFBQUFnQUFBQUFBQklBQUFBQUFBQUFBQUFBQUFBd0FBQUVBQUFBQUFBQUFBUUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDI4NTMsImV4cCI6MTc4MjMxMzY1M30.-KRm6pCuoFtOZvq8eouuNGLdPYXR8hBKFJsc6EB3FXU)

- **参数限制**


      1、  **入参类型限制**  ：  入参仅支持字符串类型及rowid类型，不支持其他类型；

      2、  **输出类型限制**  ：返回类型  VARCHAR，其长度视rowid值而定；

      3、  **入参值限制**  ：必须符合rowid格式，否则转换失败，null除外。其中rowid格式（dataoid:spaceId:fileId:blockId:dir）各模块范围：dataoid(0，18446744073709551616)，spaceid[0，2048), fileid[0,64), blockid[0,67108864), dir[0,4096)；

     4、  **返回长度限制**  ：返回长度最少为9位(0:0:0:0:0)，最多为42位(18446744073709551615:2047:63:67108863:4095)；

     5、  **null**  ：  当rowid为NULL时返回NULL；

     6、  **入参个数**  ：1。

  


**2、需求来源**

需求来源：    
  国信证券--融选适配    
    
  场 景：    
  1、将rowid值转换为VARCHAR数据类型，长度跟进rowid值而定    
    
  需求描述：    
  支持ROWIDTOCHAR函数，将rowid值转换为VARCHAR数据类型，长度跟进rowid值而定    
    
  需求范围：    
  1、单机、集群    
  2、行表

  


**3、功能分析**

将rowid值转换为VARCHAR数据类型，其长度视rowid值而定；

与Oracle差异：

|  
|Example|Description|结论|
|---|---|---|---|
|YashanDB|select rowid from dual;,![](https://pingcode.yasdb.com/atlas/files/public/67396cb5a1ad9a3311dc8c73/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBSUFBQVFBQWdBSUFBQUFBQUFBQUFBQUFFQUFBQUFBQUFBQUFBQUFBQUFBZ0FBQUFBQUVJQUFBQ0FBQUFBQUFBQUFBUUFBQUFBQUJBQUFRQUFBQUFBQUFBQUFCQUFBQUFBQUFBQUFBZ0FDQUVBQUFBQUFFQUFBQUFBQUFnQUFBQUFBQklBQUFBQUFBQUFBQUFBQUFBd0FBQUVBQUFBQUFBQUFBUUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDI4NTMsImV4cCI6MTc4MjMxMzY1M30.-KRm6pCuoFtOZvq8eouuNGLdPYXR8hBKFJsc6EB3FXU)|ROWID的数据格式为：,**dataoid:spaceId:fileId:blockId:dir**,--各个模块解释如下：,dataoid      data object id，行所在的Segment的ID，该值可从user_objects等视图中查询获得。,spaceId      space id，行所在的表空间的ID，该值可从v$tablespace等视图中查询获得。,fileId           file id，行所在数据文件在对应表空间中的数据文件ID，该值可从v$datafile等视图中查询获得。,blockId       block id，行所在数据块在对应文件中的块ID。,dir              dir，行在数据块上的槽位。,  
,根据yasdb的ROWID设计，各模块范围为dataoid[0，18446744073709551616)，spaceid[0，2048), fileid[0,64), blockid[0,67108864), dir[0,4096),返回长度最少为9位(0:0:0:0:0)，最多为42位(18446744073709551615:2047:63:67108863:4095)。|1、YashanDB和Oracle的rowid显示不同，无法进行结果对比,2、YashanDB和Oracle返回结果长度不一致，前者视rowid长度而定（范围[9,42]），后者返回长度固定为18位|
|Oracle|select rowid from dual;,![](https://pingcode.yasdb.com/atlas/files/public/67396cb5a1ad9a3311dc8c74/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBSUFBQVFBQWdBSUFBQUFBQUFBQUFBQUFFQUFBQUFBQUFBQUFBQUFBQUFBZ0FBQUFBQUVJQUFBQ0FBQUFBQUFBQUFBUUFBQUFBQUJBQUFRQUFBQUFBQUFBQUFCQUFBQUFBQUFBQUFBZ0FDQUVBQUFBQUFFQUFBQUFBQUFnQUFBQUFBQklBQUFBQUFBQUFBQUFBQUFBd0FBQUVBQUFBQUFBQUFBUUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDI4NTMsImV4cCI6MTc4MjMxMzY1M30.-KRm6pCuoFtOZvq8eouuNGLdPYXR8hBKFJsc6EB3FXU)|**Rowid长度固定为18位，基于base64编码**,格式如下：AAAAAAAABBBBBBBBRRRR,![](https://pingcode.yasdb.com/atlas/files/public/67396cb58970c2af4f520e03/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBSUFBQVFBQWdBSUFBQUFBQUFBQUFBQUFFQUFBQUFBQUFBQUFBQUFBQUFBZ0FBQUFBQUVJQUFBQ0FBQUFBQUFBQUFBUUFBQUFBQUJBQUFRQUFBQUFBQUFBQUFCQUFBQUFBQUFBQUFBZ0FDQUVBQUFBQUFFQUFBQUFBQUFnQUFBQUFBQklBQUFBQUFBQUFBQUFBQUFBd0FBQUVBQUFBQUFBQUFBUUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDI4NTMsImV4cCI6MTc4MjMxMzY1M30.-KRm6pCuoFtOZvq8eouuNGLdPYXR8hBKFJsc6EB3FXU)||


参考：    [Rowid - 赵忠源 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/display/~zhaozhongyuan/Rowid)  

# 3.   **测试设计方法**

使用边界值，等价类，场景分析等测试方法。

如rowid数据格式测试中使用了边界值测试，非法入参类型测试使用了等价类测试，函数位置测试使用了场景分析法。

# 4.   **详细测试设计**

1）使用章节3的测试方法设计详细的测试点，可沿用xmind的方式

![](https://pingcode.yasdb.com/atlas/files/public/67396cb58970c2af4f520e04/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBSUFBQVFBQWdBSUFBQUFBQUFBQUFBQUFFQUFBQUFBQUFBQUFBQUFBQUFBZ0FBQUFBQUVJQUFBQ0FBQUFBQUFBQUFBUUFBQUFBQUJBQUFRQUFBQUFBQUFBQUFCQUFBQUFBQUFBQUFBZ0FDQUVBQUFBQUFFQUFBQUFBQUFnQUFBQUFBQklBQUFBQUFBQUFBQUFBQUFBd0FBQUVBQUFBQUFBQUFBUUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDI4NTMsImV4cCI6MTc4MjMxMzY1M30.-KRm6pCuoFtOZvq8eouuNGLdPYXR8hBKFJsc6EB3FXU)

2）梳理该特性是否涉各个专项测试，并在详细设计中描述具体测试点

|专项|是否涉及|
|---|---|
|并发|是|
|长稳|  
|
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
|性能|  
|
|可维护性|  
|


附件：

[YDBRD-29579 支持ROWIDTOCHAR函数测试设计.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjYjVhMWFkOWEzMzExZGM4YzZmIiwicmVmX2lkIjoiNjczOTZjYjU3MjgyMDZlZmI5MmYxNjAzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAyODUzLCJleHAiOjE3ODIzODkyNTN9.FaUgLbqn_jgMwXBSN1OFCjC3ybfB7PyFF2EoLH4dMU8)

# 5.   **测试用例**

测试设计细化后的文本用例

详见附件

# 6.   **测试框架设计**

1. 沿用guider框架


# 7.   **测试环境说明**

|服务器类型|操作系统|服务器个数|部署节点|
|:---|:---|:---|:---|
|VM|CentOS Linux release 7.9.2009 (Core)|1|  
|


## Attachments:

[image2024-4-7_17-4-26.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjYjVhMWFkOWEzMzExZGM4YzcwIiwicmVmX2lkIjoiNjczOTZjYjU3MjgyMDZlZmI5MmYxNjAzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAyODUzLCJleHAiOjE3ODIzODkyNTN9.dr-ZM9oOEblG2wxTwofhzzKA_m37tsMvE3uVxLrHnpI)

 (image/png)    


[image2023-12-5_16-32-32.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjYjU4OTcwYzJhZjRmNTIwZTAwIiwicmVmX2lkIjoiNjczOTZjYjU3MjgyMDZlZmI5MmYxNjAzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAyODUzLCJleHAiOjE3ODIzODkyNTN9.kocZb18cf3tSc7VbLtcdwyz-hK8_3ei3Q76iu_pz_k0)

 (image/png)    


[YDBRD-29579 支持ROWIDTOCHAR函数测试设计.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjYjU4OTcwYzJhZjRmNTIwZTAxIiwicmVmX2lkIjoiNjczOTZjYjU3MjgyMDZlZmI5MmYxNjAzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAyODUzLCJleHAiOjE3ODIzODkyNTN9.KkjMJZzvIc5Pv5JIsvgzZ6znqIgQJNHkOxbDuVjr-g0)

 (application/x-xmind)    


[YDBRD-29579 支持ROWIDTOCHAR函数测试设计.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjYjVhMWFkOWEzMzExZGM4YzZmIiwicmVmX2lkIjoiNjczOTZjYjU3MjgyMDZlZmI5MmYxNjAzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAyODUzLCJleHAiOjE3ODIzODkyNTN9.FaUgLbqn_jgMwXBSN1OFCjC3ybfB7PyFF2EoLH4dMU8)

 (application/x-xmind)    


## Comments:

|  [](null)  ,会议纪要    
    
  参与人：刘晓旋、韩晓盼、赵忠源    
    
  评审时间：2024年4月8日    
    
  评审地点：25座702会议    
    
  会议补充内容：,1、入参值为32k，包含字符首位包含空格等情况,2、where/on后面，涉及不同字符类型的隐式转换情况,3、涉及  view、物化视图、index（索引列包含函数，看下计划）    
    
  遗留问题：    
    
  无    
    
  评审结论：通过,Posted by hanxiaopan at 四月 08, 2024 11:05|
|---|
