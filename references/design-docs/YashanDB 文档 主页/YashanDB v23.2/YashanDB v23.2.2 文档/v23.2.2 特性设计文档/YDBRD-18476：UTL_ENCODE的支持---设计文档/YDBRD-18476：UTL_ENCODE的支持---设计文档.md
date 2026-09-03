Created by 徐靖怡, last modified on 四月 09, 2024

*IR链接：*    [YDBRD-18476](https://jira.yasdb.com/browse/YDBRD-18476?src=confmacro)    *-*  *支持UTL_ENCODE内置系统包*  *设计中*

##   [1. 总述](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#1-%E6%80%BB%E8%BF%B0)  

Oracle提供了一系列的内置包（Package），称为“内置高级包”，提供在一个数据库实例内具有控制和管理功能的一种服务，它为用户提供了无尽的功能可能，如：加密、随机数生成、数据包解析等。

1、和UDP相比，内置高级包其实就和函数的概念类似，有各种各样的高级包，根据实际使用需求可以使用不同的高级包，一个包下面有很多个函数。

2、内置高级包只有调用操作，并没有DDL操作（创建、修改、删除）

UTL_ENCODE包提供了将RAW类型数据编码为标准编码格式的函数，以便数据可以在主机之间传输。该包还包含编码函数的解码对应函数。这些函数遵循已发布的编码标准，以适应发送端或接收端的非oracle实用程序。

base64算法介绍：base64是一种可逆的编码方式。base64是一种基于64个可打印字符来表示二进制数据的表示方法。由于2的6次方等于64，所以每6个比特为一个单元，对应某个可打印字符。3个字节有24个比特，对应于4个Base64单元，

即3个字节可由4个可打印字符来表示。  在Base64中可打印字符包括字母A-Z、a-z、数字0-9，这样共有62个字符，此外两个可打印符号在不同的系统中而不同。如若是少了“位”，即用0填充。若是少了一组，直接用“=”代替。

  [1.1 需求来源](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#11-%E9%9C%80%E6%B1%82%E6%9D%A5%E6%BA%90)  

**当前特性支持的部署形态为单机、集群。**

###   [1.2 调研文档](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#12-%E8%B0%83%E7%A0%94%E6%96%87%E6%A1%A3)  

  [https://conf.yasdb.com/pages/resumedraft.action?draftId=147777052&draftShareId=b16b7a86-b824-4efa-b6d6-eb18accf34bf&](https://conf.yasdb.com/pages/resumedraft.action?draftId=147777052&draftShareId=b16b7a86-b824-4efa-b6d6-eb18accf34bf&)  

###   [1.3 需求分析](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#13-%E9%9C%80%E6%B1%82%E5%88%86%E6%9E%90)  

  [1.4 数据字典](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#14-%E6%95%B0%E6%8D%AE%E5%AD%97%E5%85%B8)  

**描述本篇文档中特性的术语集**

|术语|描述|借鉴业界|参考|
|:---|:---|:---|:---|
|术语1|描述|是|业界资料链接|
|术语2|描述|无|原创技术，参考技术设计链接|


###   [1.5 开源依赖](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#15-%E5%BC%80%E6%BA%90%E4%BE%9D%E8%B5%96)  

无

##   [2. 接口](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#2-%E6%8E%A5%E5%8F%A3)  

### 功能：将RAW类型数据进行编码，传给对端，对端能解码出原始的RAW类型数据。

高级包中有两个函数：    
  (1)对RAW类型数据进行编码的函数

(2)对已经编码好的RAW类型数据进行解码的函数

##   [3. 规格与约束](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#3-%E8%A7%84%E6%A0%BC%E4%B8%8E%E7%BA%A6%E6%9D%9F)  

**说明从SR层级对外的功能规格或约束。结合《特性调研文档》，给出我们与竞品的差异点、优缺点描述。**     规格要参考商业数据库，由SE给出，由产品评审。约束需要SE/MDE确定方案给出。

##   [4. 特性](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#4-%E7%89%B9%E6%80%A7)      `  
`  

###   [4.1 特性设计](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#41-%E7%89%B9%E6%80%A7%E8%AE%BE%E8%AE%A1)  

![](https://pingcode.yasdb.com/atlas/files/public/67396cc8a1ad9a3311dc8cc3/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQkFBQkFCRUlBQUtBQUFBQUFBQ0FBQUFDQUFBQUFBQUJJQUFJSUFFQkFBSUFBQUFnQUFnQWdDQUFBRUFFZ0FBQkFBQUFCQUFSUUFBQUNBQUpBQUlDQUFBQUFSSUFBRUFCSUFBRUFrQUFBRWdBQVFnQUFBUUFBQUFCQkFBQUFBQUFBQUNBQUFBZ0FJSUFBQUFTQUFnQUtBQUFBUUFBQUFBQVlBQUFBQ1FRPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDM0MjEsImV4cCI6MTc4MjMxNDIyMX0.8fY0UvJWS6uBtpIGusONN-QwHQu1ZXto9jc0rfFvJVk)

![](https://pingcode.yasdb.com/atlas/files/public/67396cc9a1ad9a3311dc8cc4/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQkFBQkFCRUlBQUtBQUFBQUFBQ0FBQUFDQUFBQUFBQUJJQUFJSUFFQkFBSUFBQUFnQUFnQWdDQUFBRUFFZ0FBQkFBQUFCQUFSUUFBQUNBQUpBQUlDQUFBQUFSSUFBRUFCSUFBRUFrQUFBRWdBQVFnQUFBUUFBQUFCQkFBQUFBQUFBQUNBQUFBZ0FJSUFBQUFTQUFnQUtBQUFBUUFBQUFBQVlBQUFBQ1FRPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDM0MjEsImV4cCI6MTc4MjMxNDIyMX0.8fY0UvJWS6uBtpIGusONN-QwHQu1ZXto9jc0rfFvJVk)

  


###   [4.2 特性功能点](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#42-%E7%89%B9%E6%80%A7%E5%8A%9F%E8%83%BD%E7%82%B92)    1

![](https://pingcode.yasdb.com/atlas/files/public/67396cc98970c2af4f520e52/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQkFBQkFCRUlBQUtBQUFBQUFBQ0FBQUFDQUFBQUFBQUJJQUFJSUFFQkFBSUFBQUFnQUFnQWdDQUFBRUFFZ0FBQkFBQUFCQUFSUUFBQUNBQUpBQUlDQUFBQUFSSUFBRUFCSUFBRUFrQUFBRWdBQVFnQUFBUUFBQUFCQkFBQUFBQUFBQUNBQUFBZ0FJSUFBQUFTQUFnQUtBQUFBUUFBQUFBQVlBQUFBQ1FRPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDM0MjEsImV4cCI6MTc4MjMxNDIyMX0.8fY0UvJWS6uBtpIGusONN-QwHQu1ZXto9jc0rfFvJVk)

###   [4.3 特性功能点](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#42-%E7%89%B9%E6%80%A7%E5%8A%9F%E8%83%BD%E7%82%B92)    2

高级包

1.添加高级包

typedef struct StBuiltinPack {    
  CodText name;    
  BipImpl* impl;    
  CodUint64 flags;    
  } BuiltinPackage;

![](https://pingcode.yasdb.com/atlas/files/public/67396cc98970c2af4f520e53/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQkFBQkFCRUlBQUtBQUFBQUFBQ0FBQUFDQUFBQUFBQUJJQUFJSUFFQkFBSUFBQUFnQUFnQWdDQUFBRUFFZ0FBQkFBQUFCQUFSUUFBQUNBQUpBQUlDQUFBQUFSSUFBRUFCSUFBRUFrQUFBRWdBQVFnQUFBUUFBQUFCQkFBQUFBQUFBQUNBQUFBZ0FJSUFBQUFTQUFnQUtBQUFBUUFBQUFBQVlBQUFBQ1FRPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDM0MjEsImV4cCI6MTc4MjMxNDIyMX0.8fY0UvJWS6uBtpIGusONN-QwHQu1ZXto9jc0rfFvJVk)

参数意义：高级包名字；用  于构造具体的某个高级包的item元素  ；支持的模式

2.添加高级包中的函数

结构体：

![](https://pingcode.yasdb.com/atlas/files/public/67396cc9a1ad9a3311dc8cc5/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQkFBQkFCRUlBQUtBQUFBQUFBQ0FBQUFDQUFBQUFBQUJJQUFJSUFFQkFBSUFBQUFnQUFnQWdDQUFBRUFFZ0FBQkFBQUFCQUFSUUFBQUNBQUpBQUlDQUFBQUFSSUFBRUFCSUFBRUFrQUFBRWdBQVFnQUFBUUFBQUFCQkFBQUFBQUFBQUNBQUFBZ0FJSUFBQUFTQUFnQUtBQUFBUUFBQUFBQVlBQUFBQ1FRPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDM0MjEsImV4cCI6MTc4MjMxNDIyMX0.8fY0UvJWS6uBtpIGusONN-QwHQu1ZXto9jc0rfFvJVk)

参数：高级包名字、函数名字、最小参数个数、最大参数个数、(volatile 关键字的主要作用是保证可见性和有序性,禁止编译器优化,内存可见性:保证变量的可见性:当一个被volatile关键字修饰的变量被一个线程修改的时候,其他线程可以立刻得到修改之后的结果)

3.给高级包中的函数添加参数

![](https://pingcode.yasdb.com/atlas/files/public/67396cc9a1ad9a3311dc8cc6/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQkFBQkFCRUlBQUtBQUFBQUFBQ0FBQUFDQUFBQUFBQUJJQUFJSUFFQkFBSUFBQUFnQUFnQWdDQUFBRUFFZ0FBQkFBQUFCQUFSUUFBQUNBQUpBQUlDQUFBQUFSSUFBRUFCSUFBRUFrQUFBRWdBQVFnQUFBUUFBQUFCQkFBQUFBQUFBQUNBQUFBZ0FJSUFBQUFTQUFnQUtBQUFBUUFBQUFBQVlBQUFBQ1FRPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDM0MjEsImV4cCI6MTc4MjMxNDIyMX0.8fY0UvJWS6uBtpIGusONN-QwHQu1ZXto9jc0rfFvJVk)

参数：参数  名字、  是入参还是出参、是否进行非空校验、参数的类型、默认值。

4.将添加的函数和高级包连接起来

![](https://pingcode.yasdb.com/atlas/files/public/67396cc98970c2af4f520e54/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQkFBQkFCRUlBQUtBQUFBQUFBQ0FBQUFDQUFBQUFBQUJJQUFJSUFFQkFBSUFBQUFnQUFnQWdDQUFBRUFFZ0FBQkFBQUFCQUFSUUFBQUNBQUpBQUlDQUFBQUFSSUFBRUFCSUFBRUFrQUFBRWdBQVFnQUFBUUFBQUFCQkFBQUFBQUFBQUNBQUFBZ0FJSUFBQUFTQUFnQUtBQUFBUUFBQUFBQVlBQUFBQ1FRPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDM0MjEsImV4cCI6MTc4MjMxNDIyMX0.8fY0UvJWS6uBtpIGusONN-QwHQu1ZXto9jc0rfFvJVk)

![](https://pingcode.yasdb.com/atlas/files/public/67396cc98970c2af4f520e55/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQkFBQkFCRUlBQUtBQUFBQUFBQ0FBQUFDQUFBQUFBQUJJQUFJSUFFQkFBSUFBQUFnQUFnQWdDQUFBRUFFZ0FBQkFBQUFCQUFSUUFBQUNBQUpBQUlDQUFBQUFSSUFBRUFCSUFBRUFrQUFBRWdBQVFnQUFBUUFBQUFCQkFBQUFBQUFBQUNBQUFBZ0FJSUFBQUFTQUFnQUtBQUFBUUFBQUFBQVlBQUFBQ1FRPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDM0MjEsImV4cCI6MTc4MjMxNDIyMX0.8fY0UvJWS6uBtpIGusONN-QwHQu1ZXto9jc0rfFvJVk)

5.  实现   bipConclude + 函数名   **和**     bipVerify + 函数名   **和**     bipExec + 函数名 

6.  使用宏  **BIP_EXTERNAL_DEC**  声明该高级包，并且将高级包所处的头文件加入高     **anl_buildin_pack.c**  ** **  文件中调用

###   [4.4 特性](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#43-%E7%89%B9%E6%80%A7%E6%80%A7%E8%83%BD%E7%82%B91)      [功能点](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#42-%E7%89%B9%E6%80%A7%E5%8A%9F%E8%83%BD%E7%82%B92)    3

函数图

![](https://pingcode.yasdb.com/atlas/files/public/67396cc9a1ad9a3311dc8cc7/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQkFBQkFCRUlBQUtBQUFBQUFBQ0FBQUFDQUFBQUFBQUJJQUFJSUFFQkFBSUFBQUFnQUFnQWdDQUFBRUFFZ0FBQkFBQUFCQUFSUUFBQUNBQUpBQUlDQUFBQUFSSUFBRUFCSUFBRUFrQUFBRWdBQVFnQUFBUUFBQUFCQkFBQUFBQUFBQUNBQUFBZ0FJSUFBQUFTQUFnQUtBQUFBUUFBQUFBQVlBQUFBQ1FRPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDM0MjEsImV4cCI6MTc4MjMxNDIyMX0.8fY0UvJWS6uBtpIGusONN-QwHQu1ZXto9jc0rfFvJVk)

编码核心函数

codBase64EncodeFromText

codBase64EncodeFromBytes

解码核心函数

codBase64DecodeToTextStrict

codBase64DecodeToBytesStrict

##   [5. Testcases（自测用例）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#5-testcases%E8%87%AA%E6%B5%8B%E7%94%A8%E4%BE%8B)  

设计开发人员自测用例（文字描述），给出开发者自测试的设计方案表格或者XMIND、开发自测的用例归档路径。

自测关注点：

1. 覆盖全面
1. 避免重复测试
1. 测试用例的可维护性


自测用例设计方法：

1. 边界值
1. 等价类
1. 正交


|  
|场景|用例|执行结果|和oracle执行结果是否一致|
|---|---|---|---|---|
|1|单机环境下，,匿名块中，采用指定参数|declare    
  a raw(20);    
  begin    
  execute immediate 'select utl_encode.base64_ENCODE(r => ''ABABADD'') from dual';    
  end;    
  /|  
|![](https://pingcode.yasdb.com/atlas/files/public/67396cc9a1ad9a3311dc8cc8/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQkFBQkFCRUlBQUtBQUFBQUFBQ0FBQUFDQUFBQUFBQUJJQUFJSUFFQkFBSUFBQUFnQUFnQWdDQUFBRUFFZ0FBQkFBQUFCQUFSUUFBQUNBQUpBQUlDQUFBQUFSSUFBRUFCSUFBRUFrQUFBRWdBQVFnQUFBUUFBQUFCQkFBQUFBQUFBQUNBQUFBZ0FJSUFBQUFTQUFnQUtBQUFBUUFBQUFBQVlBQUFBQ1FRPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDM0MjEsImV4cCI6MTc4MjMxNDIyMX0.8fY0UvJWS6uBtpIGusONN-QwHQu1ZXto9jc0rfFvJVk)|
|2|单机环境下，,select查询中，采用指定参数|select utl_encode.base64_ENCODE(r => 'ABABADD') from dual;|  
|![](https://pingcode.yasdb.com/atlas/files/public/67396cc9a1ad9a3311dc8cc9/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQkFBQkFCRUlBQUtBQUFBQUFBQ0FBQUFDQUFBQUFBQUJJQUFJSUFFQkFBSUFBQUFnQUFnQWdDQUFBRUFFZ0FBQkFBQUFCQUFSUUFBQUNBQUpBQUlDQUFBQUFSSUFBRUFCSUFBRUFrQUFBRWdBQVFnQUFBUUFBQUFCQkFBQUFBQUFBQUNBQUFBZ0FJSUFBQUFTQUFnQUtBQUFBUUFBQUFBQVlBQUFBQ1FRPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDM0MjEsImV4cCI6MTc4MjMxNDIyMX0.8fY0UvJWS6uBtpIGusONN-QwHQu1ZXto9jc0rfFvJVk)|
|3|单机环境下，,select查询中，采用直接传入参数|select utl_encode.base64_ENCODE('ABABABABA') from dual;|  
|![](https://pingcode.yasdb.com/atlas/files/public/67396cc98970c2af4f520e56/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQkFBQkFCRUlBQUtBQUFBQUFBQ0FBQUFDQUFBQUFBQUJJQUFJSUFFQkFBSUFBQUFnQUFnQWdDQUFBRUFFZ0FBQkFBQUFCQUFSUUFBQUNBQUpBQUlDQUFBQUFSSUFBRUFCSUFBRUFrQUFBRWdBQVFnQUFBUUFBQUFCQkFBQUFBQUFBQUNBQUFBZ0FJSUFBQUFTQUFnQUtBQUFBUUFBQUFBQVlBQUFBQ1FRPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDM0MjEsImV4cCI6MTc4MjMxNDIyMX0.8fY0UvJWS6uBtpIGusONN-QwHQu1ZXto9jc0rfFvJVk)|
|4|单机环境下，,匿名块中，采用直接传入参数|declare    
  begin    
  execute immediate 'select utl_encode.base64_ENCODE(:1) from dual' using 'ABABABABA';    
  end;    
  /|  
|![](https://pingcode.yasdb.com/atlas/files/public/67396cc98970c2af4f520e57/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQkFBQkFCRUlBQUtBQUFBQUFBQ0FBQUFDQUFBQUFBQUJJQUFJSUFFQkFBSUFBQUFnQUFnQWdDQUFBRUFFZ0FBQkFBQUFCQUFSUUFBQUNBQUpBQUlDQUFBQUFSSUFBRUFCSUFBRUFrQUFBRWdBQVFnQUFBUUFBQUFCQkFBQUFBQUFBQUNBQUFBZ0FJSUFBQUFTQUFnQUtBQUFBUUFBQUFBQVlBQUFBQ1FRPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDM0MjEsImV4cCI6MTc4MjMxNDIyMX0.8fY0UvJWS6uBtpIGusONN-QwHQu1ZXto9jc0rfFvJVk)|


##   [6.资料设计章节](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#6%E8%B5%84%E6%96%99%E8%AE%BE%E8%AE%A1%E7%AB%A0%E8%8A%82)  

  [https://docs.oracle.com/en/database/oracle/oracle-database/21/arpls/UTL_ENCODE.html#GUID-FD7CB3AC-4CCF-4E2A-8D94-017D8AFBB505](https://docs.oracle.com/en/database/oracle/oracle-database/21/arpls/UTL_ENCODE.html#GUID-FD7CB3AC-4CCF-4E2A-8D94-017D8AFBB505)  

  [https://eco.dameng.com/document-preview/dm/zh-cn/pm/utl_encode-package](https://eco.dameng.com/document-preview/dm/zh-cn/pm/utl_encode-package)  

  [https://help.aliyun.com/zh/polardb/polardb-for-oracle/utl-encode?utm_content=g_1000230851](https://help.aliyun.com/zh/polardb/polardb-for-oracle/utl-encode?utm_content=g_1000230851)  

  [内置高级包指导文档](https://conf.yasdb.com/pages/viewpage.action?pageId=91777833)  

  [bip函数](https://conf.yasdb.com/pages/viewpage.action?pageId=113969895)  

##   [7.未来规划](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#7%E6%9C%AA%E6%9D%A5%E8%A7%84%E5%88%92)  

说明本方案遗留待解决的问题、下一步需要解决的问题或者未来演进规划。

## Attachments:

[image2023-6-3_16-38-15.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjYzc4OTcwYzJhZjRmNTIwZTQzIiwicmVmX2lkIjoiNjczOTZjYzc3MjgyMDZlZmI5MmYxNmE1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAzNDIxLCJleHAiOjE3ODIzODk4MjF9.KlhN1yokzoSVOjFPSFAcKuNapKiIZZ7Ydgs54zSQvv4)

 (image/png)    


[image2023-5-8_10-17-29.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjYzdhMWFkOWEzMzExZGM4Y2IzIiwicmVmX2lkIjoiNjczOTZjYzc3MjgyMDZlZmI5MmYxNmE1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAzNDIxLCJleHAiOjE3ODIzODk4MjF9.KY8TvLOeJ4_JksD-OF7J95nGuyucHsm8XzctRwn2SEs)

 (image/png)    


[image2023-6-5_17-6-32.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjYzdhMWFkOWEzMzExZGM4Y2I0IiwicmVmX2lkIjoiNjczOTZjYzc3MjgyMDZlZmI5MmYxNmE1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAzNDIxLCJleHAiOjE3ODIzODk4MjF9.7hewlBWhM8zShgMrwI_wSon2ROM-b8exkqiDQE3kE-w)

 (image/png)    


[image2023-6-2_17-30-5.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjYzdhMWFkOWEzMzExZGM4Y2I1IiwicmVmX2lkIjoiNjczOTZjYzc3MjgyMDZlZmI5MmYxNmE1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAzNDIxLCJleHAiOjE3ODIzODk4MjF9.LFGm8m5ApDGki_cbluks9I99wNtrh78CkGb4BCKW0XY)

 (image/png)    


[3-3.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjYzc4OTcwYzJhZjRmNTIwZTQ0IiwicmVmX2lkIjoiNjczOTZjYzc3MjgyMDZlZmI5MmYxNmE1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAzNDIxLCJleHAiOjE3ODIzODk4MjF9.sK5B1UDgLfVyCqHgru9AzaWiY00ZhqPR81RALd2Idr8)

 (image/png)    


[image2023-6-2_18-9-48.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjYzdhMWFkOWEzMzExZGM4Y2I2IiwicmVmX2lkIjoiNjczOTZjYzc3MjgyMDZlZmI5MmYxNmE1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAzNDIxLCJleHAiOjE3ODIzODk4MjF9.tqVGw2lopZh_qJsQW7o48d1mD1-SJyX45xsY68uJEHI)

 (image/png)    


[image2023-6-3_17-30-6.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjYzc4OTcwYzJhZjRmNTIwZTQ1IiwicmVmX2lkIjoiNjczOTZjYzc3MjgyMDZlZmI5MmYxNmE1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAzNDIxLCJleHAiOjE3ODIzODk4MjF9.ztCR2JAnLLSGCwTLsfZQPK4OAI4DrSenZJYLEO9uxd4)

 (image/png)    


[image2023-6-2_18-12-53.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjYzdhMWFkOWEzMzExZGM4Y2I3IiwicmVmX2lkIjoiNjczOTZjYzc3MjgyMDZlZmI5MmYxNmE1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAzNDIxLCJleHAiOjE3ODIzODk4MjF9.O6hdZF85w5TOau1GJAa3wYVl4cKttMPeNXUWJU3DHIk)

 (image/png)    


[image2023-6-2_18-19-34.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjYzc4OTcwYzJhZjRmNTIwZTQ2IiwicmVmX2lkIjoiNjczOTZjYzc3MjgyMDZlZmI5MmYxNmE1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAzNDIxLCJleHAiOjE3ODIzODk4MjF9.LJrFDCdhGsFGC0tXkh0UQELDoPsofuiKUitkxZW2UlA)

 (image/png)    


[image2023-6-2_16-28-17.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjYzdhMWFkOWEzMzExZGM4Y2I4IiwicmVmX2lkIjoiNjczOTZjYzc3MjgyMDZlZmI5MmYxNmE1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAzNDIxLCJleHAiOjE3ODIzODk4MjF9.JWULLgTriank2PbTU-bhmmgeS_Kgh1hi7wNKMkTKP3U)

 (image/png)    


[image2023-6-5_16-56-37.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjYzc4OTcwYzJhZjRmNTIwZTQ3IiwicmVmX2lkIjoiNjczOTZjYzc3MjgyMDZlZmI5MmYxNmE1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAzNDIxLCJleHAiOjE3ODIzODk4MjF9.whZT83VQPshxI-hMQaZzfRrcT04P2ocx3Ap9zxoU45c)

 (image/png)    


[image2023-6-7_10-4-5.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjYzc4OTcwYzJhZjRmNTIwZTQ4IiwicmVmX2lkIjoiNjczOTZjYzc3MjgyMDZlZmI5MmYxNmE1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAzNDIxLCJleHAiOjE3ODIzODk4MjF9.LMSUmE-dSBuCLq0heNg8LXlrYaBPmdnRxQjWrYVlxVA)

 (image/png)    


[image2023-6-5_15-12-17.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjYzhhMWFkOWEzMzExZGM4Y2I5IiwicmVmX2lkIjoiNjczOTZjYzc3MjgyMDZlZmI5MmYxNmE1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAzNDIxLCJleHAiOjE3ODIzODk4MjF9.kzoPQSXQ_jyVSq16c1FqTsoOpS5clXJMj6Yu2KmYF34)

 (image/png)    


[image2024-4-2_14-45-40.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjYzhhMWFkOWEzMzExZGM4Y2JhIiwicmVmX2lkIjoiNjczOTZjYzc3MjgyMDZlZmI5MmYxNmE1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAzNDIxLCJleHAiOjE3ODIzODk4MjF9.5t8U_6oPh-9w1CozV2yRo4c8f9ETSuJHai4wBtQ4ktY)

 (image/png)    


[image2024-4-2_17-52-55.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjYzg4OTcwYzJhZjRmNTIwZTRjIiwicmVmX2lkIjoiNjczOTZjYzc3MjgyMDZlZmI5MmYxNmE1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAzNDIxLCJleHAiOjE3ODIzODk4MjF9.U9xyTvctJ9f0dAwHp2agAcjoAU72xWROHQnciOCTboU)

 (image/png)    


[image2024-4-7_15-33-10.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjYzhhMWFkOWEzMzExZGM4Y2JkIiwicmVmX2lkIjoiNjczOTZjYzc3MjgyMDZlZmI5MmYxNmE1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAzNDIxLCJleHAiOjE3ODIzODk4MjF9.HIgewNpw1FwOiwm6YgqgvWHsts1mqzZpCeJ1iraOT-k)

 (image/png)    


[image2024-4-8_10-45-43.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjYzhhMWFkOWEzMzExZGM4Y2MwIiwicmVmX2lkIjoiNjczOTZjYzc3MjgyMDZlZmI5MmYxNmE1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAzNDIxLCJleHAiOjE3ODIzODk4MjF9.RB8PJqmlYvV8-O5eSzemLuxEs2nYBKHU2yXMLAL0C-E)

 (image/png)    


[image2024-4-8_10-46-26.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjYzhhMWFkOWEzMzExZGM4Y2MxIiwicmVmX2lkIjoiNjczOTZjYzc3MjgyMDZlZmI5MmYxNmE1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAzNDIxLCJleHAiOjE3ODIzODk4MjF9.4pX0IMQPmKFP_lZFYrs-VwWCPCCWkaGVYvZN9AzOIig)

 (image/png)    


## Comments:

|  [](null)  ,入参是能隐式转换成raw类型的数据,Posted by xujingyi at 四月 09, 2024 15:37|
|---|
|  [](null)  ,本地试一下oracle不改配置的raw支持多长。,  
,Posted by xujingyi at 四月 09, 2024 15:40|
|  [](null)  ,确定入参和出参的规格,Posted by xujingyi at 四月 09, 2024 15:41|
|  [](null)  ,string、blob、rowid、urowid转raw类型     函数初始加一个varconvert,Posted by xujingyi at 四月 09, 2024 15:43|
|  [](null)  ,与会人：谭思宇，徐靖怡，林永豪，徐瑶，孟麟    
  会议时间：2024/04/09    
  会议地点：702,会议纪要：,1.  确定入参和出参的长度规格,Posted by tansiyu at 四月 10, 2024 19:05|
