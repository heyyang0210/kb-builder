Created by 陈钦卿, last modified on 十月 12, 2024

# 1、概述

SQL LOADER  **服务端**  新增容错机制

- ERRORS
- BADFILE
- DISCARDFILE
- LOG
- SILENT


对于rejected的数据和discard的数据分别写入对应的文件，log文件用于记录导入过程中的具体情况，包括导入了几条数据，数据因为什么rejected等具体信息。

# 2、需求分析

SR：    [YDBRD-13225](https://jira.yasdb.com/browse/YDBRD-13225?src=confmacro)    -  SQL LOADER服务端支持bad，discard，log  完成

（1）ERRORS

SQL loader的容错个数，当bad文件中的个数达到errors的个数，则会终止程序并退出。

**语法**  ： options(errors = parameter_value)

parameter_value的最小值是0，最大值为Uint32，默认为50。

![](https://pingcode.yasdb.com/atlas/files/public/67396977a1ad9a3311dc76af/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQ0FBRUFBQUFBQkFBQUFFQUFBQUFBSUFBQUVBQUFBQUNBSUFBQUFBQUFDQUFDQ0FBQUFBQUFRQUFBZ0FBQUJCQUFBQUFBQUFBQUFBQkVBQUFBQUlBQkFBQUFBSUFBQUFBRUFRQUFBQUFBQUFBQUNDQUFBQUFBQUFnQUFBQUFRQUJJQVFBQUFBQUNBQVFBQUJBQUFBQUFnQUlBQUFBQUFBQUFDQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMDY4OTcsImV4cCI6MTc4MjIxNzY5N30.g2kDwu5f996Im919h3wuDVnEMFwBwOA5nlGGv1ECFHM)

（2）BADFILE

**语法**  ： BADFILE directory_path [filename]，目录需用单引号框起。

**生成条件**     ：无论是否指定，只要有rejected数据就会生成。对于一些非法路径，如不存在，不进行报错，当有rejected数据需要写入时，将之前的内容commit并报错退出。

指定BADFILE但没有rejected数据，不生成bad文件。

**何种数据会被放入BADFILE**  ：

- 1.类型转换失败的数据；
- 2.违反约束的数据；
- 3.不符合csv格式的数据。
- 4.未命中分区的数据。


只要被任意一张表reject，将不会插入，并写入bad文件中。如果没有生成bad文件的权限，继续导入但不写文件，并在log文件中声明。

  


（3）DISCARDFILE

**语法**  ：discard ::= DISCARDFILE directory_path [filename] [{ DISCARDS | DISCARDMAX } integer]

**说明**  ：directory_path部分同BADFILE，后可通过指定discardNum来选择丢弃的上限，达到上限后停止导入。

**生成条件**  ：不指定真的不生成

**何种数据会被放入DISCARDFILE**  ：

- 1.不满足when子句的语句；（只要可以导入任意一张表都不会被写入）
- 2.整行映射均为NULL的数据。


补充说明：如果一行数据存在类型转换等问题，如果满足WHEN子句，则写入BADFILE中；如果不满足，则写入DISCARDFILE中。

  


（4）LOG

如果不指定log参数，则在当前目录下生成。

如果无法生成log文件，即没有权限情况下，导入报错终止。

log文件示例

![](https://pingcode.yasdb.com/atlas/files/public/673969778970c2af4f51f837/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQ0FBRUFBQUFBQkFBQUFFQUFBQUFBSUFBQUVBQUFBQUNBSUFBQUFBQUFDQUFDQ0FBQUFBQUFRQUFBZ0FBQUJCQUFBQUFBQUFBQUFBQkVBQUFBQUlBQkFBQUFBSUFBQUFBRUFRQUFBQUFBQUFBQUNDQUFBQUFBQUFnQUFBQUFRQUJJQVFBQUFBQUNBQVFBQUJBQUFBQUFnQUlBQUFBQUFBQUFDQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMDY4OTcsImV4cCI6MTc4MjIxNzY5N30.g2kDwu5f996Im919h3wuDVnEMFwBwOA5nlGGv1ECFHM)

异常：导入过程中CTRL+C

![](https://pingcode.yasdb.com/atlas/files/public/67396977a1ad9a3311dc76b0/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQ0FBRUFBQUFBQkFBQUFFQUFBQUFBSUFBQUVBQUFBQUNBSUFBQUFBQUFDQUFDQ0FBQUFBQUFRQUFBZ0FBQUJCQUFBQUFBQUFBQUFBQkVBQUFBQUlBQkFBQUFBSUFBQUFBRUFRQUFBQUFBQUFBQUNDQUFBQUFBQUFnQUFBQUFRQUJJQVFBQUFBQUNBQVFBQUJBQUFBQUFnQUlBQUFBQUFBQUFDQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMDY4OTcsImV4cCI6MTc4MjIxNzY5N30.g2kDwu5f996Im919h3wuDVnEMFwBwOA5nlGGv1ECFHM)

  


（5）SILENT

为true则不生成log文件，默认false

# 3、功能与限制

（1）BADFILE，DISCARDFILE，LOG 路径规格

![](https://pingcode.yasdb.com/atlas/files/public/673969778970c2af4f51f838/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQ0FBRUFBQUFBQkFBQUFFQUFBQUFBSUFBQUVBQUFBQUNBSUFBQUFBQUFDQUFDQ0FBQUFBQUFRQUFBZ0FBQUJCQUFBQUFBQUFBQUFBQkVBQUFBQUlBQkFBQUFBSUFBQUFBRUFRQUFBQUFBQUFBQUNDQUFBQUFBQUFnQUFBQUFRQUJJQVFBQUFBQUNBQVFBQUJBQUFBQUFnQUlBQUFBQUFBQUFDQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMDY4OTcsImV4cCI6MTc4MjIxNzY5N30.g2kDwu5f996Im919h3wuDVnEMFwBwOA5nlGGv1ECFHM)

（2）  违反约束时，将会回滚一批数据，即使超过errors也写入badfile

（3）满足when，但被rejected，写入badfile；不满足when，写入discardfile

# 4、详细测试设计

采用等价类划分，边界值  ，场景法组合及错误推测法进行设计。

- 参数校验
- 功能校验
- 并发


[SQLLOADER容错机制测试设计.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5Nzc4OTcwYzJhZjRmNTFmODMzIiwicmVmX2lkIjoiNjczOTY5Nzc1OTNmOTljOWZmMjM0ZjI2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA2ODk3LCJleHAiOjE3ODIyOTMyOTd9.jypuqWAxWtKlPWH39G1V1oOlCJUwulnT4UDeypla6cg)

# 5、yasldr优雅报错测试记录

|  
|  
|
|---|---|
|![](https://pingcode.yasdb.com/atlas/files/public/67396977a1ad9a3311dc76b1/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQ0FBRUFBQUFBQkFBQUFFQUFBQUFBSUFBQUVBQUFBQUNBSUFBQUFBQUFDQUFDQ0FBQUFBQUFRQUFBZ0FBQUJCQUFBQUFBQUFBQUFBQkVBQUFBQUlBQkFBQUFBSUFBQUFBRUFRQUFBQUFBQUFBQUNDQUFBQUFBQUFnQUFBQUFRQUJJQVFBQUFBQUNBQVFBQUJBQUFBQUFnQUlBQUFBQUFBQUFDQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMDY4OTcsImV4cCI6MTc4MjIxNzY5N30.g2kDwu5f996Im919h3wuDVnEMFwBwOA5nlGGv1ECFHM)|关于error的问题还需要确认一下，违反check约束binder线程的fetched lines是4032；而bad原因是无效数字的binder线程fetched lines为4；这是为什么呢？,--,无效数字是在客户端检查的 约束是在服务端检查的 客户端检查的时候 错误统计是全局共享的 只要有一个binder检测到超过错误行数了 就会发出abort指令 这时候就会去stop其他线程,服务端检查约束的时候 是一行一行去尝试 然后将错误信息返回给客户端 客户端一行一行去解析 然后更新全局错误统计 在解析完服务端发的错误信息后 会去判断是否已经超过限制了,binder线程是先解析再写入吗,--,是的 只有达到batchSize 或者数据结束了之后 才会发送到服务端|
|![](https://pingcode.yasdb.com/atlas/files/public/67396977a1ad9a3311dc76b2/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQ0FBRUFBQUFBQkFBQUFFQUFBQUFBSUFBQUVBQUFBQUNBSUFBQUFBQUFDQUFDQ0FBQUFBQUFRQUFBZ0FBQUJCQUFBQUFBQUFBQUFBQkVBQUFBQUlBQkFBQUFBSUFBQUFBRUFRQUFBQUFBQUFBQUNDQUFBQUFBQUFnQUFBQUFRQUJJQVFBQUFBQUNBQVFBQUJBQUFBQUFnQUlBQUFBQUFBQUFDQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMDY4OTcsImV4cCI6MTc4MjIxNzY5N30.g2kDwu5f996Im919h3wuDVnEMFwBwOA5nlGGv1ECFHM)|batch_size=1时，binder的fetched lines应该是4比较合理吧,不是说客户端多线程，并行情况下，有一个线程达到上限就终止吗？怎么又综合两个线程看服务端了呢,--,总数是3的时候 A和B各读了一条数据 A处理的快 先判断 这时候B已经读了哇|
|![](https://pingcode.yasdb.com/atlas/files/public/673969788970c2af4f51f839/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQ0FBRUFBQUFBQkFBQUFFQUFBQUFBSUFBQUVBQUFBQUNBSUFBQUFBQUFDQUFDQ0FBQUFBQUFRQUFBZ0FBQUJCQUFBQUFBQUFBQUFBQkVBQUFBQUlBQkFBQUFBSUFBQUFBRUFRQUFBQUFBQUFBQUNDQUFBQUFBQUFnQUFBQUFRQUJJQVFBQUFBQUNBQVFBQUJBQUFBQUFnQUlBQUFBQUFBQUFDQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMDY4OTcsImV4cCI6MTc4MjIxNzY5N30.g2kDwu5f996Im919h3wuDVnEMFwBwOA5nlGGv1ECFHM)|客户端校验的数据类型,BOOL:    
  TINYINT:    
  SMALLINT:    
  INTEGER:    
  BIGINT:    
  FLOAT:    
  DOUBLE:    
  NUMBER:    
  DATE:    
  SHORTTIME:    
  TIMESTAMP:    
  TIMESTAMP_TZ:    
  TIMESTAMP_LTZ:    
  YM_INTERVAL:    
  DS_INTERVAL:    
  ROWID:,其余在服务端。,服务端报错的 只有服务端返回的消息处理结束的时候才会去判断。--故会达到4032|
|  
|  
|


  


  


## Attachments:

[om导数测试设计.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5NzdhMWFkOWEzMzExZGM3NmE5IiwicmVmX2lkIjoiNjczOTY5Nzc1OTNmOTljOWZmMjM0ZjI2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA2ODk3LCJleHAiOjE3ODIyOTMyOTd9.IrHG4QwzkA9kCLB3Gmo9AzVQJ6HKylkfrQcSFXPUI24)

 (application/x-xmind)    


[image2023-9-12_14-42-13.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5Nzc4OTcwYzJhZjRmNTFmODM2IiwicmVmX2lkIjoiNjczOTY5Nzc1OTNmOTljOWZmMjM0ZjI2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA2ODk3LCJleHAiOjE3ODIyOTMyOTd9.-4FlPWbEy9Bf_hyL9AT0Yk6fdQXTcx-RgFeRmXTnBPI)

 (image/png)    


[SQLLOADER容错机制测试设计.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5Nzc4OTcwYzJhZjRmNTFmODMzIiwicmVmX2lkIjoiNjczOTY5Nzc1OTNmOTljOWZmMjM0ZjI2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA2ODk3LCJleHAiOjE3ODIyOTMyOTd9.jypuqWAxWtKlPWH39G1V1oOlCJUwulnT4UDeypla6cg)

 (application/x-xmind)    
