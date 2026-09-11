Created by 未知用户 (liaofeng), last modified on 六月 09, 2023

##   [1. Overview（概述）](#1-overview概述)  

**简介**  在原先已实现的extProc Java的基础上新增支持extProc C。    
  需要将C语言程序打包成动态链接库，创建对应的library对象后，再在创建外置udf时使用该library对象。调用外置udf时运行C语言函数，返回结果。

- 通过yex_server执行C语言函数
- 支持参数按值传递和按引用传递（由in，out，in out决定）
- 由于C语言没有异常捕获机制，编写C语言程序时需要注意不要引发异常，否则会导致yex_server程序core dumped（yex_server之后会由yasdb的守护线程重新拉起）
- 系统表和权限、审计同extProc JAVA一样


  [创建和使用extProc C示例](https://conf.yasdb.com/pages/viewpage.action?pageId=109580168)  

##   [2. Features（功能特性）](#2-features功能特性)  

###   [extproc执行框架 （与extProc java一致）](#extproc执行框架-与extproc-java一致)  

用户首先需要使用CREATE LIBRARY语法创建lib（创建library时不检查文件）。    
  再使用CREATE PROCEDURE/FUNCTION语法将extproc注册为so proc，通过call specifiction子句指定LANGUAGE，lib和c/java_string_literal_name。提取出lang, uid, name, func, libFile, libName生成ExtProcDef，用于执行时发送给yex_server，找到唯一的method。    
  当用户调用extproc时，数据库识别到为extproc，将通过uds连接，将ExtProcDef信息，入参等发送给yex_server，等待代理程序执行结束后返回结果报文，再对报文进行处理，得到返回值。    
  yex_server代理程序在启动后开启监听线程，收到来自数据库发送的执行报文后，启动新session和线程，解析报文信息，生成ExtProcDef，从lib中找到method，执行method，将返回结果填入sendPack报文内，发送给数据库。

![](https://pingcode.yasdb.com/atlas/files/public/67396a308970c2af4f51fcf0/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUJBQUJBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQWdBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMTE1ODMsImV4cCI6MTc4MjIyMjM4M30._vGxjxDcSxlVrBQaBpZjzRzPgoGj1sireB2KNE5M6XM)

###   [创建自定义库](#创建自定义库)  

使用CREATE LIBRARY语句创建自定义库，（与extProc JAVA相同）

###   [call_spec子句](#call-spec子句)  

1. **C语言的extproc**   语法：    
  **c_declaration**


```
{IS | AS} {LANGUAGE C | EXTERNAL } { [ NAME name ] LIBRARY lib_name | LIBRARY lib_name [ NAME name ] }; 

```

**IS/AS EXTERNAL**    
  oracle为了兼容老版本语法，建议使用IS/AS LANGUAGE代替。

**c_string_literal_name**    
  c语言函数的名称,默认全转为大写，如需要区分大小写，请使用双引号。如果省略，默认为外置udf的名称    
  名称需要为合法的标识符，最大64字节

###   [用户C函数](#用户c函数)  

extProc C通过YacHandle作为C函数的唯一入参。    
  C函数需要YacResult作为返回值    
  如果用户C函数不满足上述要求，可能会导致执行结果错误甚至发生异常导致yex_server程序core dumped（yex_server之后会由yasdb的守护线程重新拉起）

###   [yep接口](#yep接口)  

通过yacli.h提供的用于出入参的yep接口组进行函数的出入参控制。    
  用户编写的C函数需要按照外置UDF的出入参顺序及类型使用yep函数值进行出入参处理，数据库无法检查用户C函数行为(ORACLE的extproc参数个数与C函数不一致也可以执行，缺少的传null，多加的忽略)。    
  yepGet函数和yepOutput函数中的id为函数定义的参数id，从0开始。用户使用yepGetXX函数时，如果传入入参类型与yepGetXX类型不一致，会尝试进行隐式类型转换（如传入int类型，使用yepGetString获取入参值，将int类型转为字符串）用户使用yepOutput函数时，类型需要与定义的出参类型一致，否则会报错。    
  用户使用yepOutput函数对同一个出参或返回值进行多次设置时，以最后一次设置为最终结果。    
  如果用户未使用yepOutput对出参进行设置，出参值不变。    
  用户使用yepReturn函数的类型与定义的返回值类型不一致时，会进行隐式类型转换外置函数，如果用户未使用yepReturn对返回值进行设置，报错。

**charsetId**    
  使用字符串类型的出入参时，需要注意处理charsetId。入参会使用yepGetCharsetId获取yasdb的charsetId，出参或返回值时，不处理charsetId(oracle同样不处理出参中的charsetId)

```
#入参接口组
YacResult yepGetCharsetId(YacHandle hProc, YacUint16* charsetId);
YacResult yepGetBool(YacHandle hProc, YacInt32 id, YacBool* v, YacInt32* lenOrInd);
YacResult yepGetInt8(YacHandle hProc, YacInt32 id, YacInt8* v, YacInt32* lenOrInd);
YacResult yepGetInt16(YacHandle hProc, YacInt32 id, YacInt16* v, YacInt32* lenOrInd);
YacResult yepGetInt32(YacHandle hProc, YacInt32 id, YacInt32* v, YacInt32* lenOrInd);
YacResult yepGetInt64(YacHandle hProc, YacInt32 id, YacInt64* v, YacInt32* lenOrInd);
YacResult yepGetDate(YacHandle hProc, YacInt32 id, YacDate* v, YacInt32* lenOrInd);
YacResult yepGetTimestamp(YacHandle hProc, YacInt32 id, YacTimestamp* v, YacInt32* lenOrInd);
YacResult yepGetYMInterval(YacHandle hProc, YacInt32 id, YacYMInterval* v, YacInt32* lenOrInd);
YacResult yepGetDSInterval(YacHandle hProc, YacInt32 id, YacDSInterval* v, YacInt32* lenOrInd);
YacResult yepGetFloat(YacHandle hProc, YacInt32 id, YacFloat* v, YacInt32* lenOrInd);
YacResult yepGetDouble(YacHandle hProc, YacInt32 id, YacDouble* v, YacInt32* lenOrInd);
YacResult yepGetNumber(YacHandle hProc, YacInt32 id, YacNumber* v, YacInt32* lenOrInd);
YacResult yepGetString(YacHandle hProc, YacInt32 id, YacChar* str, YacUint32 bufSize, YacInt32* lenOrInd);
YacResult yepGetBytes(YacHandle hProc, YacInt32 id, YacUint8* bytes, YacUint32 bufSize, YacInt32* lenOrInd);

#出参接口组
YacResult yepOutputNull(YacHandle hProc, YacInt32 id);
YacResult yepOutputBool(YacHandle hProc, YacInt32 id, YacBool v);
YacResult yepOutputInt8(YacHandle hProc, YacInt32 id, YacInt8 v);
YacResult yepOutputInt16(YacHandle hProc, YacInt32 id, YacInt16 v);
YacResult yepOutputInt32(YacHandle hProc, YacInt32 id, YacInt32 v);
YacResult yepOutputInt64(YacHandle hProc, YacInt32 id, YacInt64 v);
YacResult yepOutputDate(YacHandle hProc, YacInt32 id, YacDate v);
YacResult yepOutputTimestamp(YacHandle hProc, YacInt32 id, YacTimestamp* v);
YacResult yepOutputYMInterval(YacHandle hProc, YacInt32 id, YacYMInterval v);
YacResult yepOutputDSInterval(YacHandle hProc, YacInt32 id, YacDSInterval v);
YacResult yepOutputFloat(YacHandle hProc, YacInt32 id, YacFloat v);
YacResult yepOutputDouble(YacHandle hProc, YacInt32 id, YacDouble v);
YacResult yepOutputNumber(YacHandle hProc, YacInt32 id, YacNumber* v);
YacResult yepOutputString(YacHandle hProc, YacInt32 id, YacChar* str);
YacResult yepOutputBytes(YacHandle hProc, YacInt32 id, YacUint8* bytes, YacUint32 size);

#返回值接口组
#define yepReturnNull(hProc) yepOutputNull(hProc, YEP_RETURN)
#define yepReturnBool(hProc, value) yepOutputBool(hProc, YEP_RETURN, value)
#define yepReturnInt8(hProc, value) yepOutputInt8(hProc, YEP_RETURN, value)
#define yepReturnInt16(hProc, value) yepOutputInt16(hProc, YEP_RETURN, value)
#define yepReturnInt32(hProc, value) yepOutputInt32(hProc, YEP_RETURN, value)
#define yepReturnInt64(hProc, value) yepOutputInt64(hProc, YEP_RETURN, value)
#define yepReturnFloat(hProc, value) yepOutputFloat(hProc, YEP_RETURN, value)
#define yepReturnDouble(hProc, value) yepOutputDouble(hProc, YEP_RETURN, value)
#define yepReturnDate(hProc, value) yepOutputDate(hProc, YEP_RETURN, value)
#define yepReturnTimestamp(hProc, value) yepOutputTimestamp(hProc, YEP_RETURN, value)
#define yepReturnYMInterval(hProc, value) yepOutputYMInterval(hProc, YEP_RETURN, value)
#define yepReturnDSInterval(hProc, value) yepOutputDSInterval(hProc, YEP_RETURN, value)
#define yepReturnNumber(hProc, value) yepOutputNumber(hProc, YEP_RETURN, value)
#define yepReturnString(hProc, value, charsetId) yepOutputString(hProc, YEP_RETURN, value)
#define yepReturnBytes(hProc, value, size) yepOutputBytes(hProc, YEP_RETURN, value, size)

```

```
//示例
#include "yacli.h"

YacResult myproc(YacHandle hProc)
{
    YacInt32 id;
    YacChar  name[32];
    YacChar  buf[1024];

    YAC_CALL(yepGetInt32(hProc, 0, &amp;id, NULL)); //get argument value
    YAC_CALL(yepGetString(hProc, 1, name, 32, NULL));

    id = id / (id % 2);
    
    snprintf(buf, 1024, "hello this is extproc demo, name: %s, id: %d", name, id);
    YAC_CALL(yepOutputInt32(hProc, 0, id));
    YAC_CALL(yepReturnString(hProc, buf));
    return YAC_SUCCESS;
}

```

**示例：**    
    [创建和使用extProc C示例](https://conf.yasdb.com/pages/viewpage.action?pageId=109580168)  

目前支持的PL/SQL数据类型对应的YAC数据类型和C语言数据类型

|PL/SQL数据类型|YAC数据类型|C语言数据类型|yep接口|
|---|---|---|---|
|BOOLEAN|YacBool|_Bool|yepXXXBool|
|(UN)TINY INT|YacInt8|char|yepXXXInt8|
|SMALL INT|YacInt16|int16|yepXXXInt16|
|INT|YacInt32|int32|yepXXXInt32|
|BIG INT|YacInt64|int64_t|yepXXXInt64|
|DATE|YacDate|YacInt64|yepXXXDate|
|TIMESTAMP|YacTimestamp|YacUint8 timestampPart[YAC_TIMESTAMP_SIZE]|yepXXXTimestamp|
|INTERVAL YEAR TO MONTH|YacYMInterval|int|yepXXXYMInterval|
|INTERVAL DAY TO SECOND|YacDSInterval|int64_t|yepXXXDSInterval|
|FLOAT|YacFloat|float|yepXXXfloat|
|DOUBLE|YacDouble|double|yepXXXdouble|
|NUMBER|YacNumber|YacUint8 numberPart[YAC_NUMBER_SIZE]|yepXXXNumber|
|CHAR/VARCHAR|YacChar*|char*|yepXXXString|
|RAW|YacUint8*|unsigned char*|yepXXXBytes|


##   [3. Interfaces（接口）](#3-interfaces接口)  

##   [4. Specification And Constraints（规格与约束）](#4-specification-and-constraints规格与约束)  

1. 当入参为null时，对于数值型参数将获得0，对于字符型参数入参str将不会赋值，用户可以通过yepGetXxx函数的lenOrInd入参获得参数是否为null。（oracle额外通过了parameters的中的INDICATOR标志入参是否为null，若不使用该参数而传入null，将会报错）
1. 由于C函数签名中不包含参数信息，用户需要按照外置udf的参数和返回值的顺序、方向、类型来使用yep接口处理C函数的出入参和返回值，当入参和yep函数不匹配时，数据库会进行隐式类型转换，出参不允许修改类型
1. C语言并没有异常处理模块，如果C函数执行出现异常（如除0异常），会导致yex_server程序core dumped（yex_server之后由yasdb守护线程自动拉起）


##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

###   [5.1 Architecture（架构）](#51-architecture架构)  

![](https://conf.yasdb.com/download/attachments/104220530/image2023-3-22_23-40-30.png?version=1&modificationDate=1679499631000&api=v2?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUJBQUJBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQWdBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMTE1ODMsImV4cCI6MTc4MjIyMjM4M30._vGxjxDcSxlVrBQaBpZjzRzPgoGj1sireB2KNE5M6XM)

extProc C整体的架构和执行流程与之前实现的extProc Java类似，主要有以下几点区别

1. 动态库是.so文件或.dll文件，通过codDynamicLibOpen函数加载动态库，通过codDynamicLibGetSym找到动态库中的符号信息。
1. 通过handler进行函数出入参和返回值的处理，需要用户显式的调用yep接口进行对应操作。（extProc C支持出参）
1. 数据库端需要增加对出参的处理
1. extProc直接通过符号调用对应函数，入参固定为YacHandle，不需要jvm相关管理。


###   [5.2 Data Structures & Flow（数据结构与流程）](#52-data-structures--flow数据结构与流程)  

```
typedef struct StYepHandler{
    CodChar*   output;
    CodChar*   input;
    CodUint16* outputCount;
    CodUint32  argCount;
    CodUint32  inSize;
    CodUint32  outBufSize;
    CodUint32  outOffset;
    CodUint8   types[YEP_MAX_ARGS];
    CodUint16  lens[YEP_MAX_ARGS];
    CodUint16  offsets[YEP_MAX_ARGS];
} YepHandler;

```

###   [5.3 Compatibility（兼容性）](#53-compatibility兼容性)  

###   [5.4 DFX设计](#54-dfx设计)  

###   [5.5 其他](#55-其他)  

#   [6. Testcases（自测用例）](#6-testcases自测用例)  

1. 语法检查
1. in, out, inout 参数，有、无、多种组合，null值，非法值，边界值
1. 绑定参数，record变量为入参
1. expr arg
1. yepGet、yepPut、yepOutput合法参数，合法id，数据类型覆盖，数据类型转换、非法类型，非法id，null值
1. c函数异常场景


##   [7.资料设计章节 资料在设计阶段，要识别出来相关需要调整的范围、大纲。](#7资料设计章节-资料在设计阶段要识别出来相关需要调整的范围大纲)  

##   [8. TODO（遗留问题） *说明本方案遗留的问题或下一步需要解决的问题。*](#8-todo遗留问题-说明本方案遗留的问题或下一步需要解决的问题)  

## Attachments:

## Comments:

|  [](null)  ,增加编译动态库的例子,Posted by liaofeng at 四月 14, 2023 18:13|
|---|
|  [](null)  ,已增加,Posted by liaofeng at 四月 26, 2023 11:30|
