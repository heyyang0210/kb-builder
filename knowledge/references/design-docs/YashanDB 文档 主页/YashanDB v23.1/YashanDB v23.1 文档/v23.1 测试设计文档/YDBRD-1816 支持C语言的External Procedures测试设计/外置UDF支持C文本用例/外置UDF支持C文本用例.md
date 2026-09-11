Created by 胡晓畔 on 四月 01, 2024

|  
|用例编号|用例测试点|级别|模块|版本交付|交付形态|是否自动化|备注|
|---|---|---|---|---|---|---|---|---|
|1|test_sdv_YDBRD1816_externalC_01|- C语言的extproc语法：IS/AS EXTERNAL
- 函数name带引号指定小写，不带引号小写默认转大写；
- C函数名缺省，缺省时默认为 udf名称；
- 名称最大长度64，覆盖边界值
- 相关视图查询:sys.library$ ,USER_OBJECTS ,创建或者删除LIBRARY是否能查到相应预期
|  
|  
|23.1|单机|是|  
|
|2|test_sdv_YDBRD1816_externalC_02|- create 3000个UDF，访问3000个动态库，再清理LIBRARY
- 结合视图USER_OBJECTS 
|  
|  
|23.1|单机|是|  
|
|3|test_sdv_YDBRD1816_externalC_03|- 外置UDF的出入参顺序及类型与C函数一致、不一致
- yepOutput出参接口： in out单次设置，多次设置，不另外设置，两个出参设置不同次数
- int，varchar类型
|  
|  
|23.1|单机|是|  
|
|4|test_sdv_YDBRD1816_externalC_04|- yepoutput 出参接口组，覆盖yepOutputInt8 ,yepOutputInt16,yepOutputInt32, yepOutputInt64
- in OUT + in + NULL,in OUT + in + NULL ， 计算结果的边界值溢出
- in OUT + in + NULL + 边界值溢出场景，非边界值场景
- in out + out，覆盖正确，不正确的yepOutputint类型接口
|  
|  
|23.1|单机|是|边界值：    `power(2,31) -1`  |
|5|test_sdv_YDBRD1816_externalC_05|- yepoutput 出参接口组，覆盖yepOutputFloat yepOutputDouble yepOutputNumber yepOutputString yepOutputBytes yepOutputBool
- yepOutputFloat,float bumber 转换；number覆盖整数，负数，边界值
- raw 和char转换，不转换，覆盖长度匹配，不匹配场景
|  
|  
|23.1|单机|是|  
|
|6|test_sdv_YDBRD1816_externalC_06|- 接口组覆盖 yepGetCharsetId yepOutputNull yepReturnNull yepReturnString
- 多次调用 yepReturn 接口，类型不匹配[可转换] int16+ int32，int + number，
- 空指针：hProc 传 NULL，result传 NULL，覆盖yepReturnBool ，yepReturnInt8
- 异常测试：非 in out 参数使用yepOutput接口，udf 中数据类型与C函数不匹配
|  
|  
|23.1|单机|是|  
|
|7|test_sdv_YDBRD1816_externalC_07|- 空指针：hProc 传 NULL，result传 NULL，覆盖yepReturnInt16，yepReturnInt32 yepReturnInt64 yepReturnFloat yepReturnDouble yepReturnDate yepReturnTimestamp  yepReturnYMInterval yepReturnDSInterval yepReturnNumber yepReturnBytes
- 参数null：覆盖 yepReturnTimestamp yepReturnNumber yepReturnBytes  ，yepOutputNull ，yepReturnNull， yepReturnNull，单个以及组合测试
- yepReturnNull 覆盖非空指针
|  
|  
|23.1|单机|是|  
|
|8|test_sdv_YDBRD1816_externalC_08|- 12个时间类型接口：yepGetDate yepOutputDate，非 out 入参使用yepOutput接口，yepReturnDate，yepGetTimestamp yepOutputTimestamp yepReturnTimestamp yepGetYMInterval yepOutputYMInterval yepReturnYMInterval  yepGetDSInterval yepOutputDSInterval yepReturnDSInterval
- 可转换类型 /不可转换类型：yepReturnString + timestamp ,yepReturnString + int
- C函数不设返回值时报错
|  
|  
|23.1|单机|是|  
|
|9|test_sdv_YDBRD1816_externalC_09|- 补充yepreturn 接口：yepReturnInt8 yepReturnInt32  yepReturnInt64 yepReturnFloat，覆盖 in，in out， out 传参
- 不支持的数据类型测试：clob blob  bit
|  
|  
|23.1|单机|是|  
|
|10|test_sdv_YDBRD1816_externalC_10_heap|- C函数覆盖全类型接口，15个yepGetXXX
- UDF覆盖匹配的数据类型，不匹配但可转换的数据类型，不匹配且不可转换的数据类型，其他类型转为 YacChar，存在不可转为YacChar的数据类型时，
- 入参 出参接口组下标测试，溢出的ID，小于0 的下标
- udf 字符入参长度大于YacChar；udf int为int32， 大于 YacInt8
- 参数个数测试：覆盖协议包 128K的bufsize 的边界值，参数个数不匹配，超过协议包限制
- 结合heap表，output多次 全类型数据；重复GET 
- 异常测试：带出参的udf直接执行，c_varchar从表中取值时，长度超过8000
|  
|  
|23.1|单机|是|参数从表中取|
|11|test_sdv_YDBRD1816_externalC_11_heap|- udf+select：从heap表查询/ 嵌套查询 UDF；UDF在order by 后；UDF 在where条件；UDF 结合
,not exists，not in，all,any,limit ,cast when，127重嵌套查询,- UDF结合  update，insert ，delete 
- UDF 加函数：cast, MOD，power
|  
|  
|23.1|单机|是|  
|
|12|test_sdv_YDBRD1816_externalC_12_tac|- C函数覆盖全类型接口，15个yepGetXXX
- UDF覆盖匹配的数据类型，不匹配但可转换的数据类型，不匹配且不可转换的数据类型，其他类型转为 YacChar，存在不可转为YacChar的数据类型时，
- 入参 出参接口组下标测试，溢出的ID，小于0 的下标
- udf 字符入参长度大于YacChar；udf int为int32， 大于 YacInt8
- 参数个数测试：覆盖协议包 128K的bufsize 的边界值，参数个数不匹配，超过协议包限制
- 结合tac表，output多次 全类型数据；重复GET 
- 异常测试：带出参的udf直接执行，c_varchar从表中取值时，长度超过8000
|  
|  
|23.1|单机|是|  
|
|13|test_sdv_YDBRD1816_externalC_13_tac|- udf+select：从tac表查询/ 嵌套查询 UDF；UDF在order by 后；UDF 在where条件；UDF 结合
,not exists，not in，all,any,limit ,cast when，127重嵌套查询,- UDF结合  update，insert ，delete 
- UDF 加函数：cast, MOD，power
|  
|  
|23.1|单机|是|  
|
|14|test_sdv_YDBRD1816_externalC_14_lsc|- C函数覆盖全类型接口，15个yepGetXXX
- UDF覆盖匹配的数据类型，不匹配但可转换的数据类型，不匹配且不可转换的数据类型，其他类型转为 YacChar，存在不可转为YacChar的数据类型时，
- 入参 出参接口组下标测试，溢出的ID，小于0 的下标
- udf 字符入参长度大于YacChar；udf int为int32， 大于 YacInt8
- 参数个数测试：覆盖协议包 128K的bufsize 的边界值，参数个数不匹配，超过协议包限制
- 结合lsc表，output多次 全类型数据；重复GET 
- 异常测试：带出参的udf直接执行，c_varchar从表中取值时，长度超过8000
|  
|  
|23.1|单机|是|  
|
|15|test_sdv_YDBRD1816_externalC_15_lsc|- udf+select：从lsc表查询/ 嵌套查询 UDF；UDF在order by 后；UDF 在where条件；UDF 结合
,not exists，not in，all,any,limit ,cast when，127重嵌套查询,- UDF结合  update，insert ，delete 
- UDF 加函数：cast, MOD，power
|  
|  
|23.1|单机|是|  
|
|16|test_sdv_YDBRD1816_externalC_16|- UDF在PLSQL中应用：UDF赋值给变量；初始化变量为UDF值；匿名块中UDF运算；游标中使用UDF；loop continue带UDF
- 存储过程中使用UDF，结合case when；结合动态SQL，静态SQL；结合异常处理
- 查询存在，不存在的UDF
|  
|  
|23.1|单机|是|  
|
|17|test_sdv_YDBRD1816_externalC_17|- UDF应用：全类型转换；UDF查询作为execute的SQL文本；LOOP循环；UDF作为for循环的边界；goto ; if then ; loop +赋值运算； 结合游标和record；UDF做return的返回值；UDF+while循环；
- 异常测试：在非sql和过程体中调用
|  
|  
|23.1|单机|是|  
|
|18|test_sdv_YDBRD1816_externalC_18|- 绑定参数：绑定参数+in；绑定参数+in out ；绑定参数+ record
- return，output测试最大值：覆盖    `varchar raw bytes  `  
|  
|  
|23.1|单机|是|  
|
|19|test_sdv_YDBRD1816_externalC_19|- 指定参数顺序，覆盖正确顺序，错误顺序
|  
|  
|23.1|单机|是|  
|
|20|test_sdv_YDBRD1816_externalC_sit_01|- 所有接口的id的边界值覆盖（负数和正数）：yepGetBool yepOutputBool yepGetInt8 yepOutputInt8  yepGetInt16 yepOutputInt16 yepGetInt32 yepOutputInt32 yepGetInt64 yepOutputInt64
|  
|  
|23.1|单机|是|  
|
|21|test_sdv_YDBRD1816_externalC_sit_02|- 所有接口的id的边界值覆盖（负数和正数）：
,yepGetDate yepOutputDate yepGetTimestamp yepOutputTimestamp yepGetYMInterval yepOutputYMInterval yepGetDSInterval yepOutputDSInterval yepGetFloat yepOutputFloat,- 覆盖时间函数 sysdate systimestamp
|  
|  
|23.1|单机|是|  
|
|22|test_sdv_YDBRD1816_externalC_sit_03|- 所有接口的id的边界值覆盖（负数和正数）：yepGetDouble yepOutputDouble yepGetNumber yepOutputNumber  yepGetBytes yepOutputBytes ；yepGetString yepOutputString覆盖char 和varchar
|  
|  
|23.1|单机|是|  
|
|23|test_sdv_YDBRD1816_externalC_sit_04|- 函数返回值为 YAC_ERROR，YAC_SUCCESS_WITH_INFO的场景--会导致yex core
- 测试yepGetBytes，yepOutputBytes，yepGetString 的size为最大值时，是否正正常传入传出--YacChar在可编译的最大长度会导致yex core
- get和output接口的v的空指针测试：yepOutputTimestamp yepGetTimestamp，yepOutputNumber yepGetNumber，yepOutputString yepGetString varchar/char  ,yepOutputBytes yepGetBytes
- 覆盖函数 sysdate systimestamp length
|  
|  
|23.1|单机|是|  
|
|24|test_sdv_YDBRD1816_externalC_sit_05|- 绑定单个参数+自定义udf+外置udf：自定义udf种调用外置UDF，覆盖绑定单个参数，int 转 number，int 转 double，转 float，转 VARCHAR ，varchar
- 绑定多个参数+自定义udf+外置udf：int 转 varchar，int 转number，VARCHAR ，varchar char，data，double转换
- 结合USER，聚合函数 median max min sum avg ，结合NVARCHAR NCHAR NCLOB  
|  
|  
|23.1|单机|是|  
|
|25|test_sdv_YDBRD1816_externalC_sit_06|- 绑定参数+procedure+外置UDF：覆盖 varchar，double，decimal，data，timestamp转换
- 外置UDF+ 集合操作：union intersect minus 
- 外置UDF结合UDP，覆盖外置udf作为UDP绑定的参数
|  
|  
|23.1|单机|是|  
|
|26|test_sdv_YDBRD1816_externalC_sit_07|- 类型补充 varchar(32000 char/byte); char(32000 char/byte)，测试yepGetString  yepoutputString ， yepReturnString最大值
- 覆盖函数 REGEXP_COUNT sysdate  lengthb 
|  
|  
|23.1|单机|是|  
|
|27|Windows_dll|- Windows编译DLL动态库，测试基本create LIBRARY，drop
,LIBRARY，外置UDF调用|  
|  
|23.1|单机|否|  
|
|28|C函数其他测试|- 不通过 YacHandle作为C函数入参，不使用yepReturn对返回值进行设置，return YAC_SUCCESS_WITH_INFO
- 覆盖gcc 编译参数
- 除0异常--yex core
- 死循环
- 超大数组
- 踩内存
- 嵌套调用外置UDF-JAVA函数
|  
|  
|23.1|单机|否|  
|
|29|yex_server测试|- kill yasdb，观察yex
- kill yex,观察yasdb
- kill session，观察yex
- 重启数据库，观察yex 以及外置UDF的创建使用
|  
|  
|23.1|单机|否|  
|
