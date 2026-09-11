Created by 陈瑞, last modified on 十一月 14, 2023

# **1.概述**

**SR链接：**

**22.2 ： **    [[YDBRD-17801] 支持非指令方式的CRC校验 - SICS-CoD Jira (yasdb.com)](https://jira.yasdb.com/browse/YDBRD-17801)  

**设计文档链接：**    [非指令方式的CRC校验 - 马程飞 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=122078725)  

**交付形态：单机**

  


# **2.需求分析**

**测试 范围分析**

外场在非指令级机器上执行了备份恢复，恢复后业务执行报错

磁盘在读写时，会分别校验页面的checksum值。已发布版本在非指令集机器上计算的checksum值为-1，恢复后，读取页面校验会报错

  [YDBRD-15827](https://jira.yasdb.com/browse/YDBRD-15827?src=confmacro)    -  【外场】查询blob类型，报错YAS-00220 utf8 sequence is wrong  解决关闭

1.实现codCrc32Default，即非指令方式的CRC校验，且修改查找表的初始化方式    
  2.计算checksum的地方添加判断0或者-1都属于invalid

3.添加UT用例看护，使用随机值比较指令方式和非指令方式的CRC校验值是否相同

### DB\_BLOCK\_CHECKSUM

* 参数类型：字符串

* 默认值：TYPICAL

* 取值范围/格式：OFF，TYPICAL，FULL

* 参数说明：指定页面的checkSum等级。OFF，不校验页面checksum；TYPICAL，磁盘读的时候校验，磁盘写的时候计算；FULL，TYPICAL的基础上，内存读也校验，内存写也重新计算。

* 修改立即生效：是

* 会话级参数：否

* 只读参数：否

  


# **3、测试设计方法**

计算checksum三种情况：

### 3.1 SSE42是指令计算。   

  


--机器自带的指令集，在读/写时候会计算/校验checksum值。我们现在使用的虚拟机，物理机一般都会带指令集

查看 lscpu | grep sse4_2，有sse4_2代表自带指令集

![](https://pingcode.yasdb.com/atlas/files/public/67396bf3a1ad9a3311dc8698/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUVBQUFBQUFBQUFBQUFBQUFJQ0FnQUFBQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUlBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUlBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBSUFBQUFBQUFBQUFBQUFBQUNBQUFFQUFRQUFBQUFBQUNBQUFBQkFBQUFBQUFBQ0FBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTgyNTEsImV4cCI6MTc4MjMwOTA1MX0.PASaMaRA4DxZU3MnBaHhmUL7ATBDp7T0CC0_fHxEJLg)

  


### 3.2 机器未带指令集（已发布的旧版本）   

  


  会将数据文件页面checksum置为 -1 （INVALID）。

  这样会导致在INVALID的备份集，在自带指令集的SSE42的机器上恢复报错。另外恢复成功，读写数据库对象也会报错。

  因此需要该需求进行兼容旧版本checksum 为 -1 的备份集，恢复到新版本。

  


### 3.3 SLICE_8是自研算法             --用自研的算法计算checsum值。

  


未带指令集的机器上安装的数据库可以用该算法计算。

  


  


  


模拟测试：

由于我们没有未带指令集的机器。在测试时，由开发分别出三个包。SSE42、INVALID、SLICE_8  分别可以生成不同算法的checksum值的数据文件。均在带指令集的机器上安装（找三台机器）。

![](https://pingcode.yasdb.com/atlas/files/public/67396bf48970c2af4f520825/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUVBQUFBQUFBQUFBQUFBQUFJQ0FnQUFBQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUlBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUlBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBSUFBQUFBQUFBQUFBQUFBQUNBQUFFQUFRQUFBQUFBQUNBQUFBQkFBQUFBQUFBQ0FBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTgyNTEsImV4cCI6MTc4MjMwOTA1MX0.PASaMaRA4DxZU3MnBaHhmUL7ATBDp7T0CC0_fHxEJLg)

观察点：

1、分别在不同算法的包生成的备份恢复。恢复是否成功

2、覆盖常用数据库对象(包括行存列存，特别是23.1 新增的一些对象)，恢复过后数据库对象使用(读)，是否正常。

3、使用现网INVALID的备份集(checksum为 -1 ) ，在SLICE_8、SSE42 恢复。使用数据库对象（读）

4、主备同步

  


覆盖场景：

1、不同包之间的备份恢复组合

![](https://pingcode.yasdb.com/atlas/files/public/67396bf4a1ad9a3311dc8699/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUVBQUFBQUFBQUFBQUFBQUFJQ0FnQUFBQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUlBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUlBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBSUFBQUFBQUFBQUFBQUFBQUNBQUFFQUFRQUFBQUFBQUNBQUFBQkFBQUFBQUFBQ0FBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTgyNTEsImV4cCI6MTc4MjMwOTA1MX0.PASaMaRA4DxZU3MnBaHhmUL7ATBDp7T0CC0_fHxEJLg)

  


2、集群，单机 （1、中主要场景交叉覆盖即可，不用组合覆盖）

3、DB_BLOCK_CHECKSUM 参数 （）

4、主备场景

5、性能

6、22.2INVALID 的版本 升级到23.1 支持的版本(本次新增场景)

  


# **4.详细测试设计**

  


# **5.测试用例**

# 6.   **测试框架设计**

不自动化。目前无非指令集机器。测试用修改代码后的包模拟测试。此类包看护需要修改代码再出包。

# 7.   **测试环境说明**

|服务器|  
|
|:---|:---|
|操作系统|Linux|
|部署|  
|


## Attachments:

[非指令方式的crc校验.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiZjM4OTcwYzJhZjRmNTIwODFkIiwicmVmX2lkIjoiNjczOTZiZjM3MjgyMDZlZmI5MmYwYzFhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk4MjUxLCJleHAiOjE3ODIzODQ2NTF9.Wq3QnbASK4-nSCZtSmOGpnPGBH_Dyhhydp_pV3BO3Tg)

 (application/x-xmind)    


[crc校验.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiZjM4OTcwYzJhZjRmNTIwODFlIiwicmVmX2lkIjoiNjczOTZiZjM3MjgyMDZlZmI5MmYwYzFhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk4MjUxLCJleHAiOjE3ODIzODQ2NTF9.ZO5vLtn01bU1lTeOJ5m4cllhVKIInh7vr3vop1KCgsY)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[非指令方式的crc校验.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiZjM4OTcwYzJhZjRmNTIwODIwIiwicmVmX2lkIjoiNjczOTZiZjM3MjgyMDZlZmI5MmYwYzFhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk4MjUxLCJleHAiOjE3ODIzODQ2NTF9.9CEXIjXo6Qf5qA9Tp2qIcMEjigXUfM41GsscxTtGg_I)

 (application/x-xmind)    


[非指令方式的crc校验.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiZjNhMWFkOWEzMzExZGM4Njk2IiwicmVmX2lkIjoiNjczOTZiZjM3MjgyMDZlZmI5MmYwYzFhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk4MjUxLCJleHAiOjE3ODIzODQ2NTF9.qIrUla5IDagyqbug_82PORx_DZ08-MMGIVb7GRZMpfY)

 (application/x-xmind)    


[image2023-10-20_9-28-54.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiZjNhMWFkOWEzMzExZGM4Njk3IiwicmVmX2lkIjoiNjczOTZiZjM3MjgyMDZlZmI5MmYwYzFhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk4MjUxLCJleHAiOjE3ODIzODQ2NTF9.IJCsq6RVMb1ZaLHoQRY9tUA-mGVyKkT0pRPaUn6n9Z4)

 (image/png)    
