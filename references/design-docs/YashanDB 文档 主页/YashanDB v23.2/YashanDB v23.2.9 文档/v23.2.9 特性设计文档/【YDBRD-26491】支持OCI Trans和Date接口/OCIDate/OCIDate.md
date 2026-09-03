Created by 方少奎, last modified on 九月 25, 2024

c驱动日期处理

Oracle文档见：    [OCI Date, Datetime, and Interval Functions (oracle.com)](https://docs.oracle.com/en/database/oracle/oracle-database/18/lnoci/oci-date-datetime-and-interval-functions.html#GUID-751D4F33-E593-4845-9D5E-8761A19BD243)  

  


fmt：

yyyyMMddHHmmssff6

yyyy-mm-dd_hh24

yyyy-mm-dd hh24:mi:ss.ff3

yyyy-mm-dd hh:mi:ss

yyyy-mm-dd hh24:mi:ss.ff6 TZH:TZM

  


|接口|参数|yacli 现有能力|oracle用例|
|---|---|---|---|
|- [x] OCIDateSysDate   ,  
|err (IN/OUT)：error句柄。,sys_date (OUT)：当前客户端系统日期和时间。,todo: 修改系统时区，查看结果差异,返回当前时区|Gets the current system date and time of the client.,获取客户端当前时间。,  
,yacNow()获得当前时间,yacDateGetDate()|```
OCIHandleAlloc( (dvoid *) envhp, (dvoid **) &errhp, OCI_HTYPE_ERROR,(size_t) 0, (dvoid **) 0);
OCIDate sysDate;
checkerr(errhp, OCIDateSysDate(errhp, &sysDate));
printf("year: %d, month: %d, day: %d, hour: %d, min: %d, sec: %d\n",
sysDate.OCIDateYYYY, sysDate.OCIDateMM, sysDate.OCIDateDD,
sysDate.OCIDateTime.OCITimeHH, sysDate.OCIDateTime.OCITimeMI, sysDate.OCIDateTime.OCITimeSS);
//=========输出=========
//year: 2024, month: 4, day: 23, hour: 15, min: 38, sec: 47
```|
|- [x] OCIDateToText   ,仅转化年月日，其他为0,todo: 接口不要inout，拆成纯in和out|err (IN/OUT)：error句柄。,date (IN)：需要转换的日期。,fmt (IN)：  转换格式。如果fmt为NULL或(text *)0，则默认使用格式“DD-MON-YY”。,fmt_length (IN)：fmt参数的长度。,lang_name (IN)：指定返回月份和日期的名称语言；如果为NULL或(text *)0，默认使用session默认语言。（YashanDB目前仅支持EN）,lang_length (IN)：参数lang_name长度。,buf_size (IN/OUT)：缓存区大小（IN）。返回生成字符串的大小（OUT）。,buf (OUT)：转换后的字符。,Returns：  如果缓冲区太小，或者传递的函数格式无效或语言未知，则此函数将返回错误。溢出也会导致错误。例如，将值 10 转换为格式“9”会导致错误。|Converts a date type to a character string.,date-string类型转换,lang_name暂不使用,  
,使用ani_datetime.c能力：,codDate2Text()|```
oratext buf[100];
ub4 len = 100;
checkerr(errhp, OCIDateToText(errhp, &sysDate, "YY-MON-DD", 10, "CHINESE", 0, &len, buf));{}
printf("len: %d, str: %s\n", len, buf);

//=========输出=========
//len: 10, str: 2024-04-23
```|
|- [x] OCIDateFromText   ,  
|err (IN/OUT)：  OCI 错误句柄。,date_str （IN）：要转换为 Oracle 日期的输入字符串。,d_str_length （IN）：输入字符串的大小。如果长度为 –1，则被视为终止字符串。date_str=NULL,fmt （IN）：转换格式。如果是指针fmt=NULL，则字符串应采用“DD-MON-YY”格式。,fmt_length （IN）：参数fmt的长度。,lang_name （IN）：指定日和月的名称和缩写的语言。如果lang_name=NULL or (text *)0 ，则使用会话的默认语言。,lang_length （IN）：参数lang_name的长度。,date（OUT）：给定字符串转换为日期。,  
,Return：如果此函数收到无效的格式、语言或输入字符串，则返回错误|Converts a character string to a date type according to the specified format.,根据指定的格式将字符串转换为日期类型。,  
,使用ani_datetime.c能力：,codText2Date()|```
OCIDate date;
checkerr(errhp, OCIDateFromText(errhp, buf, len, (const oratext *) "YYYY-MM-DD", 10, NULL, 0, &date));
printf("year: %d, month: %d, day: %d, hour: %d, min: %d, sec: %d\n",
date.OCIDateYYYY, date.OCIDateMM, date.OCIDateDD,
date.OCIDateTime.OCITimeHH, date.OCIDateTime.OCITimeMI, date.OCIDateTime.OCITimeSS);
//=========输出=========
//year: 2024, month: 4, day: 23, hour: 0, min: 0, sec: 0
```|
|- [x] OCIDateTimeSysTimeStamp   |hndl (IN/OUT)：  OCI 用户会话句柄或环境句柄。,err (IN/OUT)：  OCI 错误句柄。,sys_date (OUT)：  指向输出时间戳的指针。,Returns,  `OCI_SUCCESS`    ; or       `OCI_INVALID_HANDLE`    , if       `err`       is a       `NULL`       pointer.|Gets the system current date and time as a time stamp with time zone.,获取系统当前日期和时间作为带有时区的时间戳。,  
,实现,yacGetSysDateTime(YacTimestamp* timestamp),初始化YacTimestampInside|```
OCIDateTime* dateTime;
checkerr(OCIDescriptorAlloc(envhp, (void **) &dateTime, OCI_DTYPE_TIMESTAMP, 0, NULL));
checkerr(OCIDateTimeSysTimeStamp(envhp, errhp, dateTime));
```|
|- [x] OCIDateTimeToText   ,  
|hndl (IN)：  OCI 用户会话句柄或环境句柄。如果传递了用户会话句柄，则转换发生在会话的    `NLS_LANGUAGE和`      `NLS_CALENDAR`    ；否则，将使用默认值。,err (IN/OUT)：OCI 错误句柄。,date (IN)：  要转换的 Oracle 日期时间值。,fmt (IN)：  转换格式。如果它是    `NULL字符串指针或者`      `(text*)0`    ，则日期将转换为该类型的默认格式的字符串。,fmt_length (IN)：  参数    `fmt`    的长度。,fsprec (IN)：  指定返回小数秒值的精度。,lang_name (IN)：  指定返回月份和日期的名称和缩写所使用的语言。如果    `lang_name`    =    `NULL`    （    `lang_name `    =     `(OraText *)0`    ），则使用会话的默认语言。,lang_length (IN)：  参数    `lang_name`    的长度。,buf_size (IN/OUT)：  缓冲区    `buf`    的大小（IN）。转换后生成的字符串的大小（OUT）。,buf (OUT)：  将转换后的字符串放入其中的缓冲区。|Converts the given date to a string according to the specified format.,根据指定的格式将给定日期转换为字符串。,  
,ani_datetime.c能力：,codTimestamp2Text()|```
ub4 buf_size = 20;
text buf[buf_size];
OraText* fmt = (unsigned char *) "YYYY-MM-DD HH24:MI:SS";
checkerr(OCIDateTimeToText(envhp, errhp, dateTime, fmt, 21, 6, NULL, 0, &buf_size, buf));
printf("%d :: %s\n", buf_size, buf);

//=========输出=========
//19 :: 2024-04-24 14:44:33
```|
|- [x] OCIDateTimeFromText   ,  
|hndl (IN)：  OCI 用户会话句柄或环境句柄。如果传递了用户会话句柄，则转换将发生在会话的NLS_LANGUAGE和会话的NLS_CALENDAR中；否则，将使用默认值。,err (IN/OUT)：  OCI 错误句柄。,date_str (IN)：  要转换为日期时间的输入字符串。,dstr_length (IN)：输入字符串的大小。如果长度为 –1，则被视为终止字符串    `date_str=`      `NULL`    。,fmt (IN)：转换格式。如果是指针    `fmt=`      `NULL`    ，则字符串应采用日期时间类型的默认格式。,fmt_length (IN)：参数    `fmt`    的长度。,lang_name (IN)：指定指定月份和日期的名称和缩写的语言。如果    `lang_name`     =     `NULL`    （    `lang_name`     =     `(text *)0`    ），则使用会话的默认语言。,lang_length (IN)：参数    `lang_name`    的长度。,datetime (OUT)：  转换为日期的给定字符串。|Converts the given string to an Oracle datetime type in the       `OCIDateTime`       descriptor, according to the specified format.,根据指定的格式，将给定字符串转换为描述符中的 Oracle 日期时间类型。,  
,ani_datetime.c能力：,codText2Timestamp()|  
|
|- [x] OCIDateTimeGetTimeZoneOffset   |hndl (IN)：OCI 用户会话句柄或环境句柄。,err (IN/OUT)：OCI 错误句柄。,datetime (IN)：指向描述符  OCIDateTime  的指针。,hour (OUT)：检索到的时区小时值。,min (OUT)：  检索到的时区分钟值。,Return,  `OCI_SUCCESS；`    或者    `OCI_ERROR`    ，如果 datetime 不包含时区（    `SQLT_DATE`    ，    `SQLT_TIMESTAMP`    ）。|Gets the time zone (hour, minute) portion of a datetime value.,获取日期时间值的时区（小时、分钟）部分。,ani_datetime.c能力：,codGetTimeZoneBias(),获得时区偏移量|```
sb1 hour, minute;
checkerr(OCIDateTimeGetTimeZoneOffset(envhp, errhp, dateTime, &hour, &minute));
printf("hour: %d, min: %d\n", hour, minute);

//=========输出=========2024-04-23 16:50:23
//hour: 8, min: 0
```|
|- [x] OCIDateTimeAssign   |hndl (IN)：  OCI 用户会话句柄或环境句柄。,err (IN/OUT)：  OCI 错误句柄。,from (IN)：开始时间，右侧的时间分配。,to (OUT)：目标时间，分配的左侧时间。,Returns,  `OCI_SUCCESS`    ; or OCI_ERROR.|Performs a datetime assignment.,执行日期时间分配。说白了就是深拷贝。,将from复制给to|  
|
|- [x] OCIDateTimeCheck   |hndl (IN)：  OCI 用户会话句柄或环境句柄。,err (IN/OUT)：  OCI 错误句柄。,date (IN)：  要检查的日期。,valid (OUT)：  如果是有效日期，返回0；否则，返回下表  中指定的所有错误位的逻辑运算符 OR 组合。,有效参数返回的错误位：,例如，如果传入的日期是2/0/1990 25:61:10（month/day/year hours:minutes:seconds format），则返回的错误为：,OCI_DT_INVALID_DAY | OCI_DT_DAY_BELOW_VALID | OCI_DT_INVALID_HOUR | OCI_DT_INVALID_MINUTE.,Returns,  `OCI_SUCCESS`    ;       `OCI_INVALID_HANDLE`    , if err is a       `NULL`       pointer;       `OCI_ERROR`    , if       `date`       or       `valid`       is a       `NULL`       pointer.|Checks if the given date is valid.,检查给定日期是否有效。,不需要c驱动能力|  
|
|宏名称|Bit Number|Error|
|  `OCI_DT_INVALID_DAY`  |0x1|Bad day|
|  `OCI_DT_DAY_BELOW_VALID`  |0x2|Bad day low bit (1=low)|
|  `OCI_DT_INVALID_MONTH`  |0x4|Bad month|
|  `OCI_DT_MONTH_BELOW_VALID`  |0x8|Bad month low bit (1=low)|
|  `OCI_DT_INVALID_YEAR`  |0x10|Bad year|
|  `OCI_DT_YEAR_BELOW_VALID`  |0x20|Bad year low bit (1=low)|
|  `OCI_DT_INVALID_HOUR`  |0x40|Bad hour|
|  `OCI_DT_HOUR_BELOW_VALID`  |0x80|Bad hour low bit (1=low)|
|  `OCI_DT_INVALID_MINUTE`  |0x100|Bad minute|
|  `OCI_DT_MINUTE_BELOW_VALID`  |0x200|Bad minute low bit (1=low)|
|  `OCI_DT_INVALID_SECOND`  |0x400|Bad second|
|  `OCI_DT_SECOND_BELOW_VALID`  |0x800|Bad second low bit (1=low)|
|  `OCI_DT_DAY_MISSING_FROM_1582`  |0x1000|Day is one of those missing from 1582|
|  `OCI_DT_YEAR_ZERO`  |0x2000|Year may not equal zero|
|  `OCI_DT_INVALID_TIMEZONE`  |0x4000|Bad time zone|
|  `OCI_DT_INVALID_FORMAT`  |0x8000|Bad date format input|
|- [x] OCIDateTimeCompare   |hndl (IN/OUT)：  OCI 用户会话句柄或环境句柄。,err (IN/OUT)：  OCI 错误句柄。,date1, date2 (IN)：  要比较的日期。,result (OUT)：,Returns,  `OCI_SUCCESS`    ;       `OCI_INVALID_HANDLE`    , if err is a       `NULL`       pointer;       `OCI_ERROR`    , if an invalid date is used or if the input date arguments are not of mutually comparable types.|Compares two datetime values.,比较两个日期时间值。,不需要c驱动|  
|
|Comparison Result|Output in result Parameter|
|  `date1`       <       `date2`  |-1|
|  `date1`       =       `date2`  |0|
|  `date1`       >       `date2`  |1|
|- [x] OCIDateTimeConvert   |hndl (IN/OUT)：  OCI 用户会话句柄或环境句柄。,err (IN/OUT)：  OCI 错误句柄。,indate (IN)：  指向输入日期的指针。,outdate (OUT)：  指向输出日期时间的指针。,Returns,  `OCI_SUCCESS`    ;       `OCI_INVALID_HANDLE`       if       `err`       is       `NULL`    ; or       `OCI_ERROR`    , if the conversion is not possible with the given input values.|Converts one datetime type to another.,将一种日期时间类型转换为另一种日期时间类型。,待实现|  
|


|宏名称|Bit Number|Error|
|---|---|---|
|  `OCI_DT_INVALID_DAY`  |0x1|Bad day|
|  `OCI_DT_DAY_BELOW_VALID`  |0x2|Bad day low bit (1=low)|
|  `OCI_DT_INVALID_MONTH`  |0x4|Bad month|
|  `OCI_DT_MONTH_BELOW_VALID`  |0x8|Bad month low bit (1=low)|
|  `OCI_DT_INVALID_YEAR`  |0x10|Bad year|
|  `OCI_DT_YEAR_BELOW_VALID`  |0x20|Bad year low bit (1=low)|
|  `OCI_DT_INVALID_HOUR`  |0x40|Bad hour|
|  `OCI_DT_HOUR_BELOW_VALID`  |0x80|Bad hour low bit (1=low)|
|  `OCI_DT_INVALID_MINUTE`  |0x100|Bad minute|
|  `OCI_DT_MINUTE_BELOW_VALID`  |0x200|Bad minute low bit (1=low)|
|  `OCI_DT_INVALID_SECOND`  |0x400|Bad second|
|  `OCI_DT_SECOND_BELOW_VALID`  |0x800|Bad second low bit (1=low)|
|  `OCI_DT_DAY_MISSING_FROM_1582`  |0x1000|Day is one of those missing from 1582|
|  `OCI_DT_YEAR_ZERO`  |0x2000|Year may not equal zero|
|  `OCI_DT_INVALID_TIMEZONE`  |0x4000|Bad time zone|
|  `OCI_DT_INVALID_FORMAT`  |0x8000|Bad date format input|


|Comparison Result|Output in result Parameter|
|---|---|
|  `date1`       <       `date2`  |-1|
|  `date1`       =       `date2`  |0|
|  `date1`       >       `date2`  |1|


  


  
