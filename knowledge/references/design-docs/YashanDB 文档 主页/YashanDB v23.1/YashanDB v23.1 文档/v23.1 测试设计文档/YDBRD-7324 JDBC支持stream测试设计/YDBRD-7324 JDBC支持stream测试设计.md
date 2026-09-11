Created by 李思语, last modified by  郑思远 on 四月 18, 2023

# 1. 概述 

本文描述JDBC支持stream测试设计

# 2. 需求分析 

**需求列表：**

  [YDBRD-7324](https://jira.yasdb.com/browse/YDBRD-7324?src=confmacro)    -  【驱动】JDBC支持stream的传输协议  完成

  [JDBC支持stream](100074838.html)  

**支持接口：**

**PreparedStatement支持：**

|接口|说明|
|---|---|
|setCharacterStream(int parameterIndex,     [java.io](http://java.io)    .Reader reader)|使用 LOB 绑定|
|setCharacterStream(int parameterIndex,     [java.io](http://java.io)    .Reader reader,int length)|长度小于32*1024，直接绑定；,大于等于32*1024，使用流绑定|
|setCharacterStream(int parameterIndex,     [java.io](http://java.io)    .Reader reader,long length)|大于等于2*1024*1024,使用 LOB 绑定|
|setAsciiStream(int parameterIndex,     [java.io](http://java.io)    .InputStream x）|使用 LOB 绑定|
|setAsciiStream(int parameterIndex,     [java.io](http://java.io)    .InputStream x,int length）|长度小于32*1024，直接绑定；,大于等于32*1024，使用流绑定|
|setAsciiStream(int parameterIndex,     [java.io](http://java.io)    .InputStream x,long length）|大于等于2*1024*1024,使用 LOB 绑定|
|setBinaryStream(int parameterIndex,     [java.io](http://java.io)    .InputStream x )|使用 LOB 绑定|
|setBinaryStream(int parameterIndex,     [java.io](http://java.io)    .InputStream x,int length )|长度小于32*1024，直接绑定；,大于等于32*1024，使用流绑定|
|setBinaryStream(int parameterIndex,     [java.io](http://java.io)    .InputStream x,long length )|大于等于2*1024*1024,使用 LOB 绑定|
|setBytes(int parameterIndex, byte x[])|长度小于32767字节，直接绑定；,大于等于32767字节，使用流绑定|
|setString(int parameterIndex, String x)|长度小于32*1024，直接绑定,大于等于32*1024，使用流绑定|


待研发补充：setBlob(int parameterIndex,     [java.io](http://java.io)    .InputStream x )

#   
  3. 测试设计方法 

主要采用的等价类划分，边界值，场景法组合及错误推测法进行设计 

测试点：

1.接口能否成功调用

2.接口set数据是否成功及符合预期

3.数据量大小测试

4.接口参数测试

5.Clob数据要测试中文

# 4. 详细测试设计

1. 数据量设置

```
 @DataProvider(name = "dataSize")
    public Object[][] dataSize() {
        return new Object[][]{
                {"1k", 1 * 1024},
                {"4000B", 4000},
                {"8k", 8 * 1024},
                {"16k", 16 * 1024},
                {"32k", 32 * 1024},
                {"64k", 64 * 1024},
                {"1M", 1024 * 1024},
                {"20M", 20 * 1024 * 1024},
        };
    }
//大数据量测试
2G,2G+1
```

2.  测试场景

|  
|参数测试|  
|
|---|---|---|
|1|InputStream /reader长度校验|为空|
|2|  
|为null|
|3|  
|有数据|
|4|InputStream /reader与 length 比较|is/rd.len<length|
|5|  
|is/rd.len=length|
|6|  
|is/rd.len>length|
|7|length取值|小于0|
|8|  
|等于0|
|9|  
|大于0|
|10|异常|conn关闭后调用|
|11|  
|pstmt关闭后调用|
|  
|绑定流|  
|
|12|使用流绑定，set流数量|1个|
|13|  
|多个|
|14|  
|与普通类型混合set|
|  
|数据类型|  
|
|15|涉及数据类型|小数据量可使用【char,varchar,raw,clob,blob】|
|16|  
|大数据量可使用【clob,blob】|


#   
  5. 测试用例 

# 6. 测试框架设计

# 7. 测试环境说明

|服务器|  
|
|:---|:---|
|操作系统|Linux|
|部署|  
|


## Attachments:

## Comments:

|  [](null)  ,兼容性测试：,高版本的客户端，低版本的服务端,Posted by zhengsiyuan at 四月 14, 2023 15:08|
|---|
|  [](null)  ,编译失败,![](https://pingcode.yasdb.com/atlas/files/public/6739696d8970c2af4f51f80d/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFCQUFBQUFBQUFBQkFBQUFBQUFBQUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQVFBQUFBRUFBQUFBQUFBQUFBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQVFBQUFBQkFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBRUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUVBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIxMjc0MjgsImV4cCI6MTc4MjEzODIyOH0.SAyEBqRzcY6ni8GiHwdfFTbHUOYY2iO3g1QtHpHESRc),![](https://pingcode.yasdb.com/atlas/files/public/6739696d8970c2af4f51f80e/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFCQUFBQUFBQUFBQkFBQUFBQUFBQUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQVFBQUFBRUFBQUFBQUFBQUFBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQVFBQUFBQkFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBRUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUVBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIxMjc0MjgsImV4cCI6MTc4MjEzODIyOH0.SAyEBqRzcY6ni8GiHwdfFTbHUOYY2iO3g1QtHpHESRc),Posted by zhengsiyuan at 四月 23, 2023 09:47|
