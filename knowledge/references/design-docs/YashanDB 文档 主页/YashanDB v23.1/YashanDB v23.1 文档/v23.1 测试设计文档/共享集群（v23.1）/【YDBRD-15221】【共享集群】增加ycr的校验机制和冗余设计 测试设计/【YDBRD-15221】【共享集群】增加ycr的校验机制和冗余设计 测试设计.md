Created by 张丽红, last modified on 十一月 08, 2023

**SR链接：**    [YDBRD-15221](https://jira.yasdb.com/browse/YDBRD-15221?src=confmacro)    **-**  **【共享集群】增加ycr的校验机制和冗余设计**  **完成**

**开发设计文档链接：**    [【YCS】崖山集群注册ycr设计方案](109576975.html)  

# **1.概述**

该方案是在原有ycr和ycs的机制上，增加一个数据保护机制，增加对于数据写入时的CRC校验，防止数据篡改

# **2.需求分析**

该特性的实现机制和数据库的双写机制类似。

原理：写数据时，先写到临时区域，再写到最终存储区，写入最终存储区域后才是真正的写入成功；在做数据读取时，会根据临时区域的状态来判断真正要读的是临时区数据还是最终存储区数据；临时区非内存区，也是磁盘上的某一块。

1、写入时：计算CRC，并依次将CRC写入到临时区域和持久化区域中

2、读取时：校验CRC，如果CRC有问题，校验临时区的CRC并用临时区数据来恢复持久化区域

# **3.规格**

1、部署形态：集群

2、部署模式：单主机磁阵+多主机磁阵

# **4.约束限制**

无

# **5.动态视图/配置参数**

无

# **6.测试设计方法**

该需要功能相对比较单点和明确，主要采用场景法，逻列ycr操作的相关场景，并针对性测试

# **7.详细测试设计**

[【YDBRD-15221】【共享集群】增加ycr的校验机制和冗余设计_测试设计.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5YzU4OTcwYzJhZjRmNTFmYTc1IiwicmVmX2lkIjoiNjczOTY5YzU3MjgyMDZlZmI5MmVmNzNhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA4OTQ1LCJleHAiOjE3ODIyOTUzNDV9.PHNBjgYaxRU5Gtp8dCi-PqhbpFdfOl7IGDPxDlEoovk)

# **8.测试用例**

[【YDBRD-15221】【共享集群】增加ycr的校验机制和冗余设计_测试用例_V1.0.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5YzU4OTcwYzJhZjRmNTFmYTc3IiwicmVmX2lkIjoiNjczOTY5YzU3MjgyMDZlZmI5MmVmNzNhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA4OTQ1LCJleHAiOjE3ODIyOTUzNDV9.xewNnyZ21dfWN2UmrRL_tosCGX2rDAk3xPZEhXm5HIE)

# **9.测试框架/测试用例自动化**

不可自动化

# **10.测试环境说明**

  


# **11.测试版本**

# **12.上车分析---同YDBRD-15222一起**

  


## Attachments:

[【YDBRD-15221】【共享集群】增加ycr的校验机制和冗余设计_测试设计.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5YzU4OTcwYzJhZjRmNTFmYTc4IiwicmVmX2lkIjoiNjczOTY5YzU3MjgyMDZlZmI5MmVmNzNhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA4OTQ1LCJleHAiOjE3ODIyOTUzNDV9.3Hg6QJEQwZXPAZqRzmZWegYMjBL777zNMHeAXRxaJ7g)

 (application/x-xmind)    


[【YDBRD-15221】【共享集群】增加ycr的校验机制和冗余设计_测试用例_V1.0.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5YzU4OTcwYzJhZjRmNTFmYTc5IiwicmVmX2lkIjoiNjczOTY5YzU3MjgyMDZlZmI5MmVmNzNhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA4OTQ1LCJleHAiOjE3ODIyOTUzNDV9.pWHnMnnh1YN416gX1pkgUrhKhabi-uIAIILc303Jpn0)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[【YDBRD-15221】【共享集群】增加ycr的校验机制和冗余设计_测试设计.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5YzU4OTcwYzJhZjRmNTFmYTc1IiwicmVmX2lkIjoiNjczOTY5YzU3MjgyMDZlZmI5MmVmNzNhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA4OTQ1LCJleHAiOjE3ODIyOTUzNDV9.PHNBjgYaxRU5Gtp8dCi-PqhbpFdfOl7IGDPxDlEoovk)

 (application/x-xmind)    


[【YDBRD-15221】【共享集群】增加ycr的校验机制和冗余设计_测试用例_V1.0.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5YzU4OTcwYzJhZjRmNTFmYTc3IiwicmVmX2lkIjoiNjczOTY5YzU3MjgyMDZlZmI5MmVmNzNhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA4OTQ1LCJleHAiOjE3ODIyOTUzNDV9.xewNnyZ21dfWN2UmrRL_tosCGX2rDAk3xPZEhXm5HIE)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


## Comments:

|  [](null)  ,1、读取数据时，先读临时区域还是持久化区域数据？,先读临时区域数据，再读持久化区域数据；,根据临时区数据的flag判断是否去读临时区数据；,2、会不会有临时区写失败的情况发生？,会有，这种情况是不可处理的,3、写入时：计算CRC，并依次将CRC写入到临时区域和持久化区域中，两次写入的CRC是否一致？,不一致，因为涉及到了flag的变更，flag发生变化之后，临时区的数据是发生了变化的,4、读取数据时，为什么流程中走了2次校验？,主要是为了处理并发场景，因为可能会有多个会话同时访问ycr盘的情况产生，这种场景下需要校验至少2次,5、出现写入失败的场景有哪些？通过什么场景或者操作触发？,ycr盘写入的过程中，异常掉电/磁盘损坏类型的操作,6、如何精确构造在将数据写入磁盘的过程中，双写区写坏、最终存储区写坏这类场景？,开发提供测试工具，可精准构造指定字段的错误,7、数据写到最终存储区之后，双写区的空间是否会被释放？,不会被释放，只是把临时区的flag给修改了，空间会被占用着，这种机制相对之前的机制，对空间的要求多了一倍,Posted by zhanglihong at 七月 17, 2023 21:48|
|---|
