# Kaggle dataset sources

Every file below was downloaded with the Kaggle command line tool. The licence
shown is the one Kaggle reports for the dataset page.

| folder | author | licence | dataset | files used |
| --- | --- | --- | --- | --- |
| `uciml` | Esther Kim (UCI ML Repository) | unknown | [SMS Spam Collection](https://www.kaggle.com/datasets/uciml/sms-spam-collection-dataset) | `sms_master.csv` |
| `gokhansoyturk` | Gokhan Soyturk | MIT | [Smishing SMS Dataset](https://www.kaggle.com/datasets/gokhansoyturk/smishing-sms-dataset) | `combined_sms.csv` |
| `naserabdullahalam` | Naser Abdullah Alam | CC BY-SA 4.0 | [Phishing Email Dataset](https://www.kaggle.com/datasets/naserabdullahalam/phishing-email-dataset) | `email_ceas.csv`, `email_enron.csv`, `email_ling.csv`, `email_nigerian.csv`, `email_phishing.csv`, `email_spamassassin.csv` |
| `joebeachcapital` | Joakim Arvidsson | CC BY 4.0 | [Windows Malwares](https://www.kaggle.com/datasets/joebeachcapital/windows-malwares) | `PE_Header.csv` |
| `joebeachcapital` | Joakim Arvidsson | CC BY 4.0 | [TUANDROMD](https://www.kaggle.com/datasets/joebeachcapital/tuandromd) | `TUANDROMD.csv` |
| `amauricio` (`mauricio`) | amauricio | CC0 | [Benign & Malicious PE Files](https://www.kaggle.com/datasets/amauricio/pe-files-malwares) | `dataset_malwares.csv` |
| `saurabhshahane` | Saurabh Shahane | CC BY 4.0 | [Android Malware Dataset](https://www.kaggle.com/datasets/saurabhshahane/android-malware-dataset) | `drebin-215-dataset-5560malware-9476-benign.csv` |
| `ankit1743` | Ankit Bhardwaj | CC0 | [Android Malware Detection Dataset](https://www.kaggle.com/datasets/ankit1743/android-malware-detection-dataset) | `Android_Malware.csv` |
| `nsaravana` | N Saravana | CC0 | [Malware Detection](https://www.kaggle.com/datasets/nsaravana/malware-detection) | `Malware dataset.csv` |

## Downloads

```bash
kaggle datasets download -d uciml/sms-spam-collection-dataset --unzip -p dataset/uciml
kaggle datasets download -d gokhansoyturk/smishing-sms-dataset --unzip -p dataset/gokhansoyturk
kaggle datasets download -d naserabdullahalam/phishing-email-dataset --unzip -p dataset/naserabdullahalam
kaggle datasets download -d joebeachcapital/windows-malwares --unzip -p dataset/joebeachcapital
kaggle datasets download -d joebeachcapital/tuandromd --unzip -p dataset/joebeachcapital
kaggle datasets download -d amauricio/pe-files-malwares --unzip -p dataset/mauricio
kaggle datasets download -d saurabhshahane/android-malware-dataset --unzip -p dataset/saurabhshahane
kaggle datasets download -d ankit1743/android-malware-detection-dataset --unzip -p dataset/ankit1743
kaggle datasets download -d nsaravana/malware-detection --unzip -p dataset/nsaravana
```

Some downloads arrive under the author's own file names. They were renamed to
the names used here (`spam.csv` to `sms_master.csv`, `dataset.csv` to
`drebin-215-dataset-5560malware-9476-benign.csv`, `CEAS_08.csv` to
`email_ceas.csv`, and so on) so the column names and file names match what
`build_datasets.py` expects. Each source folder has an `INFO.md` with the
details.

## Sources that were downloaded and rejected

| source | why it is not used |
| --- | --- |
| `ang3loliveira/malware-analysis-datasets-pe-section-headers` | 96 to 97% malware, so there is no benign class to learn from |
| `rtatman/the-national-university-of-singapore-sms-corpus` | no label column, so the rows cannot be trained or scored |
| `nsaravana/malware-detection` used for classification | each of the 100 processes is repeated 1000 times and every snapshot of a process carries the same label, so a classifier would identify the process. The file is used for regression instead. |
| `saurabhshahane/android-permission-dataset` | 1,927 package IDs appear with both labels, so the rows are genuinely ambiguous |
