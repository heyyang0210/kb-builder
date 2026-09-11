Created by 易文亮, last modified on 八月 14, 2023

# **1. 概述**

本文描述LSC表支持对象存储的测试设计

# **2. 需求分析**

SR：        [YDBRD-16697](https://jira.yasdb.com/browse/YDBRD-16697?src=confmacro)    -  单机支持LSC对象存储  完成

开发设计：    [LSC表支持对象存储 - 谢锐 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=112726601)  

语法：CREATE TABLESPACE tablespace_name ... DATABUCKET 'bucket_path' | 'bucket_name' S3(URL 'url', [REGION ‘region',], ACCESS KEY 'ak', SECRET KEY 'sk')；

           alter databucket 'bucket_name|path' READONLY|READWRITE;

分析：

1、创建表空间带databucket的旧语法不变，增加MAXSIZE设置，bucket_clause增加S3存储的语法，有效的语法创建表空间成功，无效的语法报错

2、alter tablespace add databucket同创建表空间语法增加S3存储部分，有效的语法alter add databucket成功，无效的语法报错

3、增加alter databucket语法，databucket默认readwrite，修改为readonly后只读不可写入，确认读写逻辑正常

4、databucket满了后也只读不可写入，分别确认所有bucket/s3 bucket都满，部分满，都不满情况下数据读写情况

5、确认s3 bucket的读写情况，url不可达/无权限创建校验报错，只有读s3 bucket的数据才会使用到diskcache

  


限制：

  


# **3. 测试**  **设计方法**   

测试设计主要采用等价类边界值，结合场景法及错误推测法进行设计

测试观察点：

1、语法功能，有效语法成功，无效语法失败，DB不异常

2、业务场景符合预期

# 4.   **详细测试设计**

4.1 语法验证

|语句部分|属性1|属性2|有效等价类|编号|无效等价类|编号|备注|
|:---|---|---|:---|:---|:---|:---|:---|
|create tablespace,/alter tablespace add|本地bucket|maxsize xx|maxsize有效范围【1M,2^64-1】,  
|  
|maxsize<1M,maxsize>=2^64|  
|  
|
||||maxsize范围内数值，不带单位|  
|maxsize带小数|  
|  
|
||||maxsize范围内，单位K/M/G/T|  
|maxsize无效单位P/E|  
|  
|
||||maxsize unlimited|  
|maxsize limited/其他错误关键字、字符串|  
|  
|
||s3 bucket|bucket_name|带引号|  
|不带引号|  
|  
|
||||大小写字母、数字、下划线|  
|其他特殊字符：星号、斜线、反斜线、竖线、问号、冒号、分号、双引号、小于号、大于号|  
|  
|
||||长度1-255|  
|空,空格|  
|  
|
||||区分大小写|  
|>255|  
|  
|
|||url|1-1023|  
|空|  
|  
|
||||  
|  
|1024|  
|  
|
||||uri满足校验要求|  
|IP|  
|  
|
||||uri长度1-255|  
|uri空|  
|  
|
||||区分大小写|  
|uri>255|  
|  
|
||||  
|  
|关键字错误,关键字缺失,  
|  
|  
|
|||region|缺省|  
|128字节|  
|  
|
||||1-127字节|  
|  
|  
|  
|
||||区分大小写|  
|关键字错误|  
|  
|
|||ak|1-127字节|  
|空|  
|  
|
||||区分大小写|  
|128字节|  
|  
|
||||  
|  
|关键字错误,账号错误|  
|  
|
|||sk|1-127字节|  
|空|  
|  
|
||||区分大小写|  
|128字节|  
|  
|
||||  
|  
|关键字错误,密码错误|  
|  
|
|||  
|  
|  
|带重复关键字|  
|  
|
|||  
|  
|  
|缺失s3等关键字|  
|  
|
||  
|  
|  
|  
|  
|  
|建表不支持|
|alter tablespace tbs alter databucket    
    
    
    
    
    
    
    
    
    
    
|  
|  
|readonly|  
|其他|  
|  
|
||  
|  
|readwrite(默认)|  
|  
|  
|  
|
||  
|  
|  
|  
|  
|  
|  
|
|  
    
  create cache tablespace    
    
    
    
|  
|  
|不带tablespace_name|  
|带cache|  
|  
|
||  
|  
|  
|  
|带其他tablespace_name|  
|  
|
||  
|  
|  
|  
|  
|  
|  
|


覆盖所有数据类型

4.2 业务场景

1、本地databucket改为readonly后只能读，不能转换写入；databucket为readwrite可读可转换写入

2、本地databucket超过maxsize后，只能读，不能转换写入，add新的databucket后，可转换写入

3、s3 bucket改为readonly后只能读，不能转换写入；databucket为readwrite可读可转换写入

4、s3 bucket超过maxsize后，只能读，不能转换写入，add新的databucket后，可转换写入

5、表空间带多个本地bucket/s3 bucket，部分bucket写满或者为readonly，不影响转换写入

6、只有s3 bucket才能使用diskcache，且需满足记录数在SCOL_CACHEABLE_SCAN_ROWS-SCOL_DISK_CACHEABLE_SCAN_ROWS范围内

  


# 5.   **测试用例**

[LSC支持对象存储测试设计.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZjY4OTcwYzJhZjRmNTFmYjU4IiwicmVmX2lkIjoiNjczOTY5ZjY1OTNmOTljOWZmMjM1NDc4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEwNDAxLCJleHAiOjE3ODIyOTY4MDF9.EgGWuOpmYWRLiuZdoxtM83UiJihDDyx1a-BxDRlIN9s)

[单机支持大对象存储测试用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZjY4OTcwYzJhZjRmNTFmYjU5IiwicmVmX2lkIjoiNjczOTY5ZjY1OTNmOTljOWZmMjM1NDc4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEwNDAxLCJleHAiOjE3ODIyOTY4MDF9.rcdFLMhK4_Rgmv7sXb0EHiRd9HexAvz7DHz6R_Xd3Lw)

# 6.   **测试框架设计**

自动化用例添加到YAT框架

# 7.   **测试环境说明**

|服务器|  
|
|:---|:---|
|操作系统|Linux|
|部署|单机+HA|


## Attachments:

[LSC支持静态数据update(ydbrd11784).xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZjZhMWFkOWEzMzExZGM3OWNlIiwicmVmX2lkIjoiNjczOTY5ZjY1OTNmOTljOWZmMjM1NDc4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEwNDAxLCJleHAiOjE3ODIyOTY4MDF9.oyNjuJGyl-VNUVjiF_IXNuknMb9VtbHQjYKQHzEhc3I)

 (application/x-xmind)    


[LSC支持scol数据删改能力(ydbrd11785).xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZjZhMWFkOWEzMzExZGM3OWNmIiwicmVmX2lkIjoiNjczOTY5ZjY1OTNmOTljOWZmMjM1NDc4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEwNDAxLCJleHAiOjE3ODIyOTY4MDF9.j72nkzYJLKyZFH_OQBSxdEzR-XiTiTuuNDddTD0nFjU)

 (application/x-xmind)    


[LSC支持对象存储测试设计.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZjY4OTcwYzJhZjRmNTFmYjU4IiwicmVmX2lkIjoiNjczOTY5ZjY1OTNmOTljOWZmMjM1NDc4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEwNDAxLCJleHAiOjE3ODIyOTY4MDF9.EgGWuOpmYWRLiuZdoxtM83UiJihDDyx1a-BxDRlIN9s)

 (application/x-xmind)    


[单机支持大对象存储测试用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZjY4OTcwYzJhZjRmNTFmYjU5IiwicmVmX2lkIjoiNjczOTY5ZjY1OTNmOTljOWZmMjM1NDc4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEwNDAxLCJleHAiOjE3ODIyOTY4MDF9.rcdFLMhK4_Rgmv7sXb0EHiRd9HexAvz7DHz6R_Xd3Lw)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    
