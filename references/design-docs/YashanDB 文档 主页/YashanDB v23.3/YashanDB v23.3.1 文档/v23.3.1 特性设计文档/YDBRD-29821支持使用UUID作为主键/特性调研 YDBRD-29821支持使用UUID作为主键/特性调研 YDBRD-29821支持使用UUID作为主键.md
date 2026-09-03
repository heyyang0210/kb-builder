  [https://pingcode.yasdb.com/pjm/items/667bdc5d288e197820af4d97?](https://pingcode.yasdb.com/pjm/items/667bdc5d288e197820af4d97?)  

#YDBRD-29821 【mysql兼容】支持使用UUID作为主键

##   [1. Overview（概述）](#1-overview概述)  

需求场景：    
  1、支持生成唯一键函数UUID()、UUID_SHORT（）    
  2、支持将唯一键函数返回的结果插入到主键列

##   [2. Features（功能特性）](#2-features功能特性)  

mysql的UUID文档：    [https://dev.mysql.com/blog-archive/mysql-8-0-uuid-support/](https://dev.mysql.com/blog-archive/mysql-8-0-uuid-support/)      
    [https://dev.mysql.com/doc/refman/5.7/en/miscellaneous-functions.html#function_uuid](https://dev.mysql.com/doc/refman/5.7/en/miscellaneous-functions.html#function_uuid)  

###   [2.1 UUID](#21-uuid)  

UUID 基于 16 进制，由 32 位小写的 16 进制数字组成，如下：aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee

UUID 的底层结构会根据版本而有所不同。    
  RFC4122 指定了 5 个版本。MySQL 在 UUID() 函数中实现的是版本 1，由时间戳、UUID 版本和 MAC 地址组成。

版本1的UUID，是根据 60-bit 的时间戳和节点（生成UUID的计算机）的48-bit MAC地址而生成的。

版本1详细规则见wiki文档：    [https://zh.wikipedia.org/wiki/%E9%80%9A%E7%94%A8%E5%94%AF%E4%B8%80%E8%AF%86%E5%88%AB%E7%A0%81#%E7%89%88%E6%9C%AC1%EF%BC%88%E6%97%A5%E6%9C%9F%E6%97%B6%E9%97%B4%E5%92%8CMAC%E5%9C%B0%E5%9D%80%EF%BC%89](https://zh.wikipedia.org/wiki/%E9%80%9A%E7%94%A8%E5%94%AF%E4%B8%80%E8%AF%86%E5%88%AB%E7%A0%81#%E7%89%88%E6%9C%AC1%EF%BC%88%E6%97%A5%E6%9C%9F%E6%97%B6%E9%97%B4%E5%92%8CMAC%E5%9C%B0%E5%9D%80%EF%BC%89)  

###   [2.2 UUID()函数](#22-uuid函数)  

UUID()返回UUID值。该值是一个 32位，表示为utf8 五个十六进制数字的字符串， aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee 格式如下：

前三个数字由时间戳的低、中、高部分生成。高部分还包括 UUID 版本号。

第四个数字保留了时间唯一性，以防时间戳值失去单调性（例如由于夏令时）。

第五个数字是 IEEE 802 节点号，它提供空间唯一性。如果后者不可用（例如，因为主机设备没有以太网卡，或者不知道如何在主机操作系统上找到接口的硬件地址），则用随机数代替。在这种情况下，无法保证空间唯一性。不过，发生冲突的概率应该 非常低。

仅在 FreeBSD、Linux 和 Windows 上才会考虑接口的 MAC 地址。在其他操作系统上，MySQL 使用随机生成的 48 位数字。

###   [2.3 UUID_SHORT()函数](#23-uuid-short函数)  

UUID_SHORT()返回一个 64 位无符号整数。 UUID_SHORT()返回的值与 UUID()函数返回的字符串格式 128 位标识符不同，并且具有不同的唯一性属性。

如果满足以下条件，则保证UUID_SHORT()的值 是唯一的：

server_id当前服务器的值介于 0 到 255 之间，并且在源服务器和副本服务器集中是唯一 的

mysqld重启 UUID_SHORT()期间，平均每秒 调用次数少于 1600 万次

返回UUID_SHORT()值的构造方式如下：

(server_id & 255) << 56 + (server_startup_time_in_seconds << 24) + incremented_variable++;

##   [3. Specification And Constraints（规格与约束）](#3-specification-and-constraints规格与约束)  

目前对应yashan下的SYS_GUID完全为随机数，无格式，未遵循RFC4122规则

##   [4. Dependency（功能依赖）](#4-dependency功能依赖)  

说明整个特性或子特性，在对应数据库下，调研得到的功能对第三方件的依赖，开源协议。

##   [5. TODO（遗留问题）](#5-todo遗留问题)  

*说明本方案遗留的问题或下一步需要解决的问题。*

Mysql源码实现方式

uuid_short的长度不固定，保证为unsigned int64范围内

![](https://pingcode.yasdb.com/atlas/files/public/67399e8d8970c2af4f52ca9e/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBSUFBQUFBQUFBQUVBQUFFQUFBaUFBQ0FBUUFBQkFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFnQkFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBRUFBQUFBQUFBQUFBQUFBQkFBQUFBQUFBQUFBQUFDQUJBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQVFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTE0NjQsImV4cCI6MTc4MjQ2MjI2NH0.uE9vcarRG_deXP_8BcqswYjw1399-NiTcprZU9Bpehs)

  


![](https://pingcode.yasdb.com/atlas/files/public/67399e8da1ad9a3311dd48fa/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBSUFBQUFBQUFBQUVBQUFFQUFBaUFBQ0FBUUFBQkFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFnQkFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBRUFBQUFBQUFBQUFBQUFBQkFBQUFBQUFBQUFBQUFDQUJBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQVFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTE0NjQsImV4cCI6MTc4MjQ2MjI2NH0.uE9vcarRG_deXP_8BcqswYjw1399-NiTcprZU9Bpehs)

![](https://pingcode.yasdb.com/atlas/files/public/67399e8ea1ad9a3311dd48fb/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBSUFBQUFBQUFBQUVBQUFFQUFBaUFBQ0FBUUFBQkFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFnQkFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBRUFBQUFBQUFBQUFBQUFBQkFBQUFBQUFBQUFBQUFDQUJBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQVFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTE0NjQsImV4cCI6MTc4MjQ2MjI2NH0.uE9vcarRG_deXP_8BcqswYjw1399-NiTcprZU9Bpehs)

## Attachments:

