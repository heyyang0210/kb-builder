Created by 陈钦卿, last modified on 十月 31, 2023

# 1、概述

yasldr增加单字节不可见字符作为列分隔符。

# 2、需求分析

SR:

22.2：    [YDBRD-15617](https://jira.yasdb.com/browse/YDBRD-15617?src=confmacro)    -  yasldr支持单字节不可见字符作为列分割符  完成

23.1：    [YDBRD-15650](https://jira.yasdb.com/browse/YDBRD-15650?src=confmacro)    -  yasldr支持单字节不可见字符作为列分割符  完成

交付方式：单机

支持的单字节不可见字符，范围是1-9，9-31(0x01-0x09，0x09-0x1F)

【ASCII表】

  [ASCII 表 | 菜鸟教程 (runoob.com)](https://www.runoob.com/w3cnote/ascii.html)  

  [ASCII码一览表，ASCII码对照表 (biancheng.net)](http://c.biancheng.net/c/ascii/)  

  [ASCII码 - 基本ASCII码和扩展ASCII码,最全的ASCII码对照表 (asciim.cn)](https://www.asciim.cn/)  

【GBK编码表】    [GBK 编码表 - 在线工具 (toolhelper.cn)](https://www.toolhelper.cn/Encoding/GBK)  

# 3、功能与限制

（1）仅支持单字节十六进制

（2）不可用单引号包围

# 4、详细测试设计

|输入条件1|输入条件2|有效等价类|备注|无效等价类|备注|
|---|---|---|---|---|---|
|单字节不可见字符,eg：,fields terminated by 0x01|十六进制、十进制|0x01-0x1F,1-31|1.不区分大小写,2.需遍历这31个字符|1、不可见字符,0(0x00) NUL (NULL)空字符,127(0x7F) DEL (Delete) 删除,2、可见字符,0x20-0x7E，0x80-0xFF,3、二进制|  
|
|  
|单字节|0x01-0x1F|  
|多字节：,0xB0A1、0xA1A1|  
|
|  
|  
|  
|  
|转义字符,terminated by '\a',![](https://pingcode.yasdb.com/atlas/files/public/6739696aa1ad9a3311dc766d/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFRQUFBQUNBQUFBQ0FBQUFJQUFBQUFBRUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIxMjcyNzMsImV4cCI6MTc4MjEzODA3M30.KH_1T22LRP-Ur90YvD5eJ9pWFhqQdzDtod2VgLGgTRw)|目前支持'\t',terminated by 0x09|
|实际分隔符与指定分隔符对应关系    
    
,  
|  
|命令：terminated by 0x01,csv：1   **chr(0x01)**   2   **chr(0x01) **  3|  
|命令：terminated by 0x01    
  csv：1  **，**  2  **，**  3,命令：terminated by 0x01    
  csv：1   **chr(0x01)**   2   **，**  3,命令：terminated by 0x01    
  csv：1   **chr(0x02)**   2   **chr(0x02)**   3|  
|
|制表符作为分隔符|  
|  
|  
|  
|  
|
|长度|  
|  
|0x001|  
|  
|
|包围符|  
|  
|  
|  
|  
|


[yasldr支持单字节不可见字符作为列分隔符.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5NjlhMWFkOWEzMzExZGM3NjZiIiwicmVmX2lkIjoiNjczOTY5Njk1OTNmOTljOWZmMjM0ZTdlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMTI3MjczLCJleHAiOjE3ODIyMTM2NzN9.XPpqbzcQAcZzZWVtVbnp7BMDoOY4auX_Iwm2rn2swRc)

**Oracle分隔符为不可见字符命令**

FIELDS TERMINATED BY     x'05'

## Attachments:

[yasldr支持单字节不可见字符作为列分隔符.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5NjlhMWFkOWEzMzExZGM3NjZiIiwicmVmX2lkIjoiNjczOTY5Njk1OTNmOTljOWZmMjM0ZTdlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMTI3MjczLCJleHAiOjE3ODIyMTM2NzN9.XPpqbzcQAcZzZWVtVbnp7BMDoOY4auX_Iwm2rn2swRc)

 (application/x-xmind)    
